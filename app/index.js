// app/index.js
import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Keyboard,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Switch,
} from "react-native";
import { useAuth } from "../src/context/AuthContext.js";
import { useLedger } from "../src/context/LedgerContext.js";
import apiClient from "../src/services/apiClient.js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialDropdown from "../src/components/MaterialDropdown.jsx";
import { generateTicketIdentities } from "../src/utils/idGenerator.js";
import { apiServices } from "../src/services/apiServices.js";
import {
  ArrowBigLeft,
  ArrowBigRight,
  Delete,
  SaveCheck,
  Trash2,
  X,
} from "lucide-react-native";
import { Button } from "expo-router/build/react-navigation";
import BluetoothPrintButton from "../src/components/BluetoothPrintButton";
import {
  validateFormStep,
  compileFinalTicketRecord,
  formatVehicleNumber,
  getVehicleKeyboardType,
} from "../src/utils/weighBridgeHelpers.js";
import CustomerSelectionField from "../src/components/CustomerSelectionField.jsx";

export default function WeighbridgeWizardScreen() {
  const { clerk, shiftId } = useAuth();
  const { appendNewTicket } = useLedger();

  // 🗺️ Wizard Navigation State
  const [currentStep, setCurrentStep] = useState(0);

  // Form Input Storage States
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [site, setSite] = useState("");
  const [materials, setMaterials] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [isMaterialsLoading, setIsMaterialsLoading] = useState(true);

  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [isCustomersLoading, setIsCustomersLoading] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // States for adding a fresh customer directly on the fly
  const [newCustomerModalVisible, setNewCustomerModalVisible] = useState(false);
  const [newCustomerNameInput, setNewCustomerNameInput] = useState("");

  // Financial Parameters Input States (Initialized cleanly as strings for text fields)
  const [materialQuantity, setMaterialQuantity] = useState("");
  const [materialRate, setMaterialRate] = useState("");
  const [isRateSettled, setIsRateSettled] = useState(true);
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [amountPaid, setAmountPaid] = useState("");

  // Royalty Control Modifiers
  const [hasRoyalty, setHasRoyalty] = useState(false); // Added for UI toggle visibility
  const [royaltyQuantity, setRoyaltyQuantity] = useState("");
  const [royaltyRate, setRoyaltyRate] = useState("");

  // Calculations Readout Cache
  const [grandTotal, setGrandTotal] = useState(0); // Added for rendering total summaries cleanly

  const [finalTicketRecord, setFinalTicketRecord] = useState({});

  const MATERIALS_CACHE_KEY = "@mandar_crusher_materials_cache";
  const CUSTOMERS_CACHE_KEY = "@mandar_crusher_customers_cache";

  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const vehicleInputRef = useRef(null);
  const customerInputRef = useRef(null);
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [printStep, setPrintStep] = useState("customer");

  // useEffect(() => {
  //   const timer = setTimeout(() => {
  //     customerInputRef.current?.focus();
  //   }, 100);

  //   return () => clearTimeout(timer);
  // }, []);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      () => setKeyboardVisible(true),
    );
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => setKeyboardVisible(false),
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  async function initializeRegistryMatrices(isMounted) {
    // 1. Activate loading feedback tracks immediately
    setIsMaterialsLoading(true);
    setIsCustomersLoading(true);

    console.log(
      "📡 Reloading material and customer registries from API on app launch...",
    );

    // --- ASYNC TASK 1: MATERIALS EXECUTION LOOP ---
    const materialsPromise = apiServices
      .materialList()
      .then(async ({ data }) => {
        if (Array.isArray(data) && data.length > 0) {
          await AsyncStorage.setItem(MATERIALS_CACHE_KEY, JSON.stringify(data));
          if (isMounted) {
            setMaterials(data);
            setSelectedMaterial(data[0].id || data[0].name);
          }
          console.log(
            "💾 Material matrix refreshed and cached to local disk storage.",
          );
        } else {
          throw new Error(
            "Empty array payload returned from materials server.",
          );
        }
      })
      .catch(async (e) => {
        console.log(
          "⚠️ Materials API reload failed. Falling back to cached materials...",
          e.message,
        );
        try {
          const cachedStringData =
            await AsyncStorage.getItem(MATERIALS_CACHE_KEY);
          if (cachedStringData !== null) {
            const parsedCacheArray = JSON.parse(cachedStringData);
            if (
              Array.isArray(parsedCacheArray) &&
              parsedCacheArray.length > 0
            ) {
              if (isMounted) {
                setMaterials(parsedCacheArray);
                setSelectedMaterial(
                  parsedCacheArray[0].id || parsedCacheArray[0].name,
                );
              }
              console.log("✅ Recovered cached materials after API failure.");
            }
          } else if (isMounted) {
            setMaterials([]);
            setSelectedMaterial("");
          }
        } catch (cacheError) {
          console.error(
            "Critical storage corruption reading material cache:",
            cacheError,
          );
        }
      })
      .finally(() => {
        if (isMounted) setIsMaterialsLoading(false);
      });

    // --- ASYNC TASK 2: CUSTOMERS EXECUTION LOOP ---
    const customersPromise = apiServices
      .customerList()
      .then(async ({ data }) => {
        if (Array.isArray(data) && data.length > 0) {
          await AsyncStorage.setItem(CUSTOMERS_CACHE_KEY, JSON.stringify(data));
          if (isMounted) {
            setCustomers(data);
          }
          console.log(
            "💾 Customer profiles refreshed and cached to local disk storage.",
          );
        } else {
          throw new Error(
            "Empty array payload returned from customers server.",
          );
        }
      })
      .catch(async (e) => {
        console.log(
          "⚠️ Customer API reload failed. Falling back to cached customers...",
          e.message,
        );
        try {
          const cachedStringData =
            await AsyncStorage.getItem(CUSTOMERS_CACHE_KEY);
          if (cachedStringData !== null) {
            const parsedCacheArray = JSON.parse(cachedStringData);
            if (
              Array.isArray(parsedCacheArray) &&
              parsedCacheArray.length > 0
            ) {
              if (isMounted) {
                setCustomers(parsedCacheArray);
              }
              console.log(
                "✅ Recovered cached customer database records after API failure.",
              );
            }
          } else if (isMounted) {
            setCustomers([]);
          }
        } catch (cacheError) {
          console.error(
            "Critical storage corruption reading customer cache:",
            cacheError,
          );
        }
      })
      .finally(() => {
        if (isMounted) setIsCustomersLoading(false);
      });

    // Execute both network/disk requests concurrently in parallel background tracks
    await Promise.allSettled([materialsPromise, customersPromise]);
  }

  useEffect(() => {
    let isMounted = true;

    initializeRegistryMatrices(isMounted);

    return () => {
      isMounted = false;
    };
  }, []);

  const handleNext = () => {
    const validation = validateFormStep({
      currentStep,
      customerName,
      vehicleNumber,
      selectedMaterial,
      materialQuantity,
      isRateSettled,
      materialRate,
      hasRoyalty,
      royaltyQuantity,
      royaltyRate,
      paymentMode,
      amountPaid,
    });
    recalculateGrandTotal(
      materialQuantity,
      materialRate,
      royaltyQuantity,
      royaltyRate,
    );

    if (!validation.valid) {
      return Alert.alert(validation.title, validation.message);
    }

    if (currentStep === 3 && !isRateSettled) {
      setCurrentStep(5);
    } else if (currentStep === 7 && !isRateSettled) {
      setCurrentStep(10);
    } else if (currentStep === 5 && !hasRoyalty && !isRateSettled) {
      setCurrentStep(10);
    } else if (currentStep === 5 && !hasRoyalty) {
      setCurrentStep(8);
    } else if (currentStep === 8 && paymentMode === "CREDIT") {
      setCurrentStep(10);
    } else {
      setCurrentStep((prev) => Math.min(10, prev + 1));
    }
  };

  const handleBack = () => {
    if (currentStep === 10 && !hasRoyalty && !isRateSettled) {
      setCurrentStep(5);
    } else if (currentStep === 10 && !isRateSettled) {
      setCurrentStep(7);
    } else if (currentStep === 10 && paymentMode === "CREDIT") {
      setCurrentStep(8);
    } else if (currentStep === 8 && !hasRoyalty) {
      setCurrentStep(5);
    } else if (currentStep === 5 && !isRateSettled) {
      setCurrentStep(3);
    } else {
      setCurrentStep((prev) => Math.max(0, prev - 1));
    }
  };

  const calculateBusinessDate = (currentDate = new Date()) => {
    const operationalDate = new Date(currentDate.getTime());
    operationalDate.setHours(operationalDate.getHours() - 9);

    const year = operationalDate.getFullYear();
    const month = String(operationalDate.getMonth() + 1).padStart(2, "0");
    const day = String(operationalDate.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  // 2. Inside your final commit trigger loop:
  const handleFinalCommit = async () => {
    const matObj = materials.find(
      (m) => m.id === selectedMaterial || m.name === selectedMaterial,
    );

    const { id, receiptNumber } = await generateTicketIdentities();
    console.log("Receipt no,: ", receiptNumber, id);

    const finalTicket = {
      id,
      shiftId,
      clerkId: clerk?.id,
      vehicleNumber: vehicleNumber.trim().toUpperCase(),
      site,
      receiptNumber: String(receiptNumber),
      customerName: customerName.trim(),
      materialName: matObj?.name || selectedMaterial,
      materialId: selectedMaterial,
      materialQuantity: Number(materialQuantity),
      materialRate: Number(materialRate),
      royaltyQuantity: Number(royaltyQuantity),
      royaltyRate: Number(royaltyRate),
      amountPaid: Number(amountPaid),
      paymentMode,
      createdAt: new Date().toISOString(),
      businessDate: calculateBusinessDate(),
      rateStatus: isRateSettled ? "SETTLED" : "OPEN",
      hasRoyalty,
      synced: false,
      isVoid: false,
      voidReason: null,
    };

    setFinalTicketRecord(finalTicket);
    try {
      await appendNewTicket(finalTicket);
      // Alert.alert("Success ✅", `Ticket ${receiptNumber} saved successfully!`);
      setPrintModalVisible(true);
      setPrintStep("customer");
    } catch (e) {
      Alert.alert("Error ❌", "Could not write transaction log.");
    }
  };

  const renderCustomKeypad = () => (
    <View style={styles.keypadContainer}>
      {[
        ["1", "2", "3"],
        ["4", "5", "6"],
        ["7", "8", "9"],
        [".", "0", { value: "BACK", icon: <Delete size={22} /> }],
        // [{ value: "CLEAR", icon: <Trash2 size={22} /> }],
      ].map((row, rIdx) => (
        <View key={rIdx} style={styles.keypadRow}>
          {row.map((btn, cIdx) => {
            const isObject = typeof btn === "object";

            return (
              <TouchableOpacity
                key={`${rIdx}-${cIdx}`}
                onPress={() => handleKeypadPress(isObject ? btn.value : btn)}
                style={[
                  styles.keypadBtn,
                  row.length === 1 && styles.keypadBtnWide,
                ]}
              >
                {isObject ? (
                  btn.icon
                ) : (
                  <Text style={styles.keypadBtnText}>{btn}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );

  const handleKeypadPress = (val) => {
    // 1. Correctly map the active screen index to its variable and target handler function
    let currentValue = "";
    let actionRouter = null;

    if (currentStep === 2) {
      currentValue = String(materialQuantity || "");
      actionRouter = handleMaterialQuantityChange;
    } else if (currentStep === 4) {
      currentValue = String(materialRate || "");
      actionRouter = handleMaterialRateChange;
    } else if (currentStep === 6) {
      currentValue = String(royaltyQuantity || "");
      actionRouter = handleRoyaltyQuantityChange;
    } else if (currentStep === 7) {
      currentValue = String(royaltyRate || "");
      actionRouter = handleRoyaltyRateChange;
    }
    // Fixed step index from 8 to 9 to match your JSX layout definition perfectly
    else if (currentStep === 9 && paymentMode === "CASH") {
      currentValue = String(amountPaid || "");
      actionRouter = setAmountPaid;
    }

    // 2. Exit early if the current screen step does not use the keypad
    if (!actionRouter) return;

    // 3. Process the layout string state safely
    if (val === "CLEAR") {
      actionRouter("");
    } else if (val === "BACK") {
      actionRouter(currentValue.slice(0, -1));
    } else if (val === ".") {
      // Prevent double decimal syntax errors
      if (!currentValue.includes(".")) {
        actionRouter(currentValue + ".");
      }
    } else {
      // Enforce decimal scale precision limit (max 2 decimal places)
      if (currentValue.includes(".")) {
        const [, decimals] = currentValue.split(".");
        if (decimals && decimals.length >= 2) return;
      }

      // Prevent entering excessively long values
      if (currentValue.length < 8) {
        actionRouter(currentValue + val);
      }
    }
  };

  const handlePrintCompleted = async () => {
    if (printStep === "customer") {
      // If they just finished printing the Customer Copy, switch to the Plant Copy
      setPrintStep("plant");
    } else {
      // If they finished printing the Plant Copy, close the modal and reset everything
      setPrintModalVisible(false);
      handleCloseAndClear();
    }
  };

  const handleCloseAndClear = () => {
    // 🗺️ Reset Navigation Steps to Start
    setPrintModalVisible(false);
    setCurrentStep(0);

    setVehicleNumber("");
    setCustomerName("");
    setCustomerSearchQuery("");
    setSite("");

    // 💰 Reset Scale & Financial Input Parameters (Clean String Resets)
    setMaterialQuantity("");
    setMaterialRate("");
    setIsRateSettled(true);

    // 👑 Reset Royalty Controls
    setHasRoyalty(false);
    setRoyaltyQuantity("");
    setRoyaltyRate("");

    // 💳 Reset Payment Processing Matrix
    setPaymentMode("CASH");
    setAmountPaid("");
    setGrandTotal(0);

    // 💾 Wipe Data Records Chained Context Caches
    setFinalTicketRecord({});
  };

  const handleRateSettledToggle = (value) => {
    setIsRateSettled(value);
    if (!value) {
      setMaterialRate("0");
      // setHasRoyalty(false);
      // setRoyaltyQuantity("");
      // setRoyaltyRate("");
      // setGrandTotal(0);

      setPaymentMode("CREDIT");
      setAmountPaid("0");
    } else {
      setMaterialRate("");
      // setRoyaltyQuantity("");
      // setRoyaltyRate("");
      setPaymentMode("CASH");
    }
  };

  const handleMaterialQuantityChange = (qty) => {
    // Always force incoming values to a clean string format
    const qtyStr = String(qty);
    setMaterialQuantity(qtyStr);

    const rateNum = Number(materialRate) || 0;
    const qtyNum = Number(qtyStr) || 0;

    const materialAmount = qtyNum * rateNum;
    const royaltyAmount =
      (Number(royaltyQuantity) || 0) * (Number(royaltyRate) || 0);
    setGrandTotal(materialAmount + royaltyAmount);
  };

  const handleMaterialRateChange = (rate) => {
    // Always force incoming values to a clean string format
    const rateStr = String(rate);
    setMaterialRate(rateStr);

    const qtyNum = Number(materialQuantity) || 0;
    const rateNum = Number(rateStr) || 0;

    const materialAmount = qtyNum * rateNum;
    const royaltyAmount =
      (Number(royaltyQuantity) || 0) * (Number(royaltyRate) || 0);
    setGrandTotal(materialAmount + royaltyAmount);
  };

  const handleRoyaltyQuantityChange = (qty) => {
    const qtyStr = String(qty);
    setRoyaltyQuantity(qtyStr);

    const rateNum = Number(royaltyRate) || 0;
    const qtyNum = Number(qtyStr) || 0;

    const materialAmount =
      (Number(materialQuantity) || 0) * (Number(materialRate) || 0);
    const royaltyAmount = qtyNum * rateNum;
    setGrandTotal(materialAmount + royaltyAmount);
  };

  const handleRoyaltyRateChange = (rate) => {
    const rateStr = String(rate);
    setRoyaltyRate(rateStr);

    const qtyNum = Number(royaltyQuantity) || 0;
    const rateNum = Number(rateStr) || 0;

    const materialAmount =
      (Number(materialQuantity) || 0) * (Number(materialRate) || 0);
    const royaltyAmount = qtyNum * rateNum;
    setGrandTotal(materialAmount + royaltyAmount);
  };
  // Unified Master Grand Total Formula updates
  const recalculateGrandTotal = (matQty, matRate, royQty, royRate) => {
    const materialAmount = matQty * matRate;
    const royaltyAmount = royQty * royRate;
    setGrandTotal(materialAmount + royaltyAmount);
  };

  const handleAmountPaidChange = (val) => {
    setAmountPaid(val);
  };

  // =========================================================
  // 🗺️ Dynamic Active Step Array Generator
  // =========================================================

  // Build a collection of steps that the user WILL actually see based on selections
  const activeStepsList = [0, 1, 2, 3];

  if (!isRateSettled) {
    activeStepsList.push(5);

    if (hasRoyalty) {
      activeStepsList.push(6);
      activeStepsList.push(7);
    }

    activeStepsList.push(10);
  } else {
    activeStepsList.push(4);
    activeStepsList.push(5);

    if (hasRoyalty) {
      activeStepsList.push(6);
      activeStepsList.push(7);
    }

    activeStepsList.push(8);

    if (paymentMode === "CASH") {
      activeStepsList.push(9);
    }

    activeStepsList.push(10);
  }

  // Calculate numbers derived directly from the generated active tracking array
  const totalDisplaySteps = activeStepsList.length;

  // Find where the clerk currently is standing inside the active flow chain
  const explicitActiveIndex = activeStepsList.indexOf(currentStep);
  const humanReadableCurrentStep =
    explicitActiveIndex !== -1 ? explicitActiveIndex + 1 : 1;

  // Calculate the progress bar completion percentage
  const progressPercentage =
    (humanReadableCurrentStep / totalDisplaySteps) * 100;

  return (
    <View style={styles.container}>
      {/* Step Indicator Top Bar */}
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          STEP {humanReadableCurrentStep} OF {totalDisplaySteps}
        </Text>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${progressPercentage}%` }, // Perfectly scaled to reflect actual visible steps
            ]}
          />
        </View>
      </View>

      {/* Main Form Step Core Card Wrapper */}
      <KeyboardAvoidingView
        style={styles.cardFrame}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 100}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "space-between",
          }}
        >
          <View style={{ flex: 1 }}>
            {/* ========================================================= */}
            {/* STEP 0: Identity Profile                                  */}
            {/* ========================================================= */}
            {currentStep === 0 && (
              <View style={[styles.stepWrapper, { zIndex: 50 }]}>
                <CustomerSelectionField
                  customerInputRef={customerInputRef}
                  customerSearchQuery={customerSearchQuery}
                  setCustomerSearchQuery={setCustomerSearchQuery}
                  setCustomerName={setCustomerName}
                  customers={customers}
                  isCustomersLoading={isCustomersLoading}
                  onRefreshCustomers={initializeRegistryMatrices}
                  onAddNewPress={() => setNewCustomerModalVisible(true)}
                  onCustomerSelected={(item) => {
                    // Automatically snap focus to the next entry field when selected
                    vehicleInputRef.current?.focus();
                  }}
                />

                <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
                  Vehicle Number
                </Text>
                <TextInput
                  ref={vehicleInputRef}
                  style={styles.formInput}
                  placeholder="e.g. MH14EU9999"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={10}
                  value={vehicleNumber}
                  // keyboardType={getVehicleKeyboardType(vehicleNumber)}
                  onChangeText={(text) =>
                    // setVehicleNumber(formatVehicleNumber(text))
                    setVehicleNumber(text)
                  }
                  onSubmitEditing={() => handleNext()}
                  returnKeyType="next"
                />
              </View>
            )}

            {/* ========================================================= */}
            {/* STEP 1: Site and Material Selection                      */}
            {/* ========================================================= */}
            {currentStep === 1 && (
              <View style={styles.stepWrapper}>
                <Text style={styles.fieldLabel}>Site</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter Site Address"
                  placeholderTextColor="#94a3b8"
                  autoCorrect={false}
                  value={site}
                  onChangeText={setSite}
                />

                {isMaterialsLoading ? (
                  <MaterialDropdown
                    materials={materials}
                    selectedMaterial={selectedMaterial}
                    setSelectedMaterial={setSelectedMaterial}
                    isMaterialsLoading={true}
                  />
                ) : materials.length > 0 ? (
                  <MaterialDropdown
                    materials={materials}
                    selectedMaterial={selectedMaterial}
                    setSelectedMaterial={setSelectedMaterial}
                    isMaterialsLoading={false}
                  />
                ) : (
                  <View style={styles.emptyMaterialsContainer}>
                    <Text style={styles.emptyMaterialsTitle}>
                      No material list found
                    </Text>
                    <Text style={styles.emptyMaterialsSubtitle}>
                      Tap below to download the latest material list.
                    </Text>
                    <TouchableOpacity
                      style={styles.nextBtn}
                      onPress={initializeRegistryMatrices}
                    >
                      <Text style={styles.nextBtnText}>Refresh Materials</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* ========================================================= */}
            {/* STEP 2: Material Quantity Weigh-In                        */}
            {/* ========================================================= */}
            {currentStep === 2 && (
              <View style={styles.stepWrapper}>
                <Text style={styles.stepTitle}>Enter Material Quantity</Text>
                <View style={styles.numericValueCard}>
                  <Text style={styles.giantValueDisplay}>
                    {materialQuantity || "0"}
                  </Text>
                  <Text style={styles.smallUnitDisplay}>ft³</Text>
                </View>
                {renderCustomKeypad()}
              </View>
            )}

            {/* ========================================================= */}
            {/* STEP 3: Rate Settlement Option Selector                  */}
            {/* ========================================================= */}
            {currentStep === 3 && (
              <View style={styles.stepWrapper}>
                <Text style={styles.stepTitle}>Rate Settlement Choice</Text>

                <View style={styles.centeredToggleBox}>
                  <Text style={styles.largeInstructionLabel}>
                    Is the rate finalized right now?
                  </Text>

                  <View style={styles.inlineToggleContainer}>
                    <Text
                      style={[
                        styles.toggleStatusText,
                        { color: isRateSettled ? "#16a34a" : "#64748b" },
                      ]}
                    >
                      {isRateSettled
                        ? "SETTLED IMMEDIATELY"
                        : "OPEN / SETTLE LATER"}
                    </Text>
                    <View>
                      <Switch
                        value={isRateSettled}
                        onValueChange={(value) =>
                          handleRateSettledToggle(value)
                        }
                        trackColor={{ false: "#cbd5e1", true: "#16a34a" }}
                        thumbColor="#ffffff"
                        style={{
                          transform: [{ scaleX: 1.3 }, { scaleY: 1.3 }],
                          marginTop: 12,
                        }}
                      />
                    </View>
                  </View>
                </View>

                <View
                  style={
                    isRateSettled
                      ? styles.infoSuccessBox
                      : styles.infoWarningBox
                  }
                >
                  <Text
                    style={
                      isRateSettled
                        ? styles.infoSuccessText
                        : styles.infoWarningText
                    }
                  >
                    {isRateSettled
                      ? "✓ Enter the rate on the next screen."
                      : "⚠ Rate status will lock to OPEN."}
                  </Text>
                </View>
              </View>
            )}

            {/* ========================================================= */}
            {/* STEP 4: Material Rate Input Board                         */}
            {/* ========================================================= */}
            {currentStep === 4 && (
              <View style={styles.stepWrapper}>
                <Text style={styles.stepTitle}>Enter Material Rate</Text>
                <View style={styles.numericValueCard}>
                  <Text style={styles.giantValueDisplay}>
                    ₹ {materialRate || "0"}
                  </Text>
                </View>

                {/* <View style={styles.liveSubtotalRow}>
                  <Text style={styles.liveSubtotalLabel}>
                    Material Subtotal:
                  </Text>
                  <Text style={styles.liveSubtotalValue}>
                    ₹
                    {Number(
                      (Number(materialQuantity) || 0) *
                        (Number(materialRate) || 0),
                    ).toLocaleString("en-IN")}
                  </Text>
                </View> */}

                {renderCustomKeypad()}
              </View>
            )}

            {/* ========================================================= */}
            {/* STEP 5: Royalty Inclusion Selector                        */}
            {/* ========================================================= */}
            {currentStep === 5 && (
              <View style={styles.stepWrapper}>
                <Text style={styles.stepTitle}>Royalty Evaluation</Text>

                <View style={styles.centeredToggleBox}>
                  <Text style={styles.largeInstructionLabel}>
                    Include Royalty Bookings for this ticket?
                  </Text>

                  <View style={styles.inlineToggleContainer}>
                    <Text
                      style={[
                        styles.toggleStatusText,
                        { color: hasRoyalty ? "#0284c7" : "#64748b" },
                      ]}
                    >
                      {hasRoyalty ? "ROYALTY INCLUDED" : "EXCLUDE ROYALTY"}
                    </Text>
                    <View>
                      <Switch
                        value={hasRoyalty}
                        onValueChange={(value) => {
                          setHasRoyalty(value);

                          if (!value) {
                            setRoyaltyQuantity("");
                            setRoyaltyRate("");
                          }
                        }}
                        trackColor={{ false: "#cbd5e1", true: "#0284c7" }}
                        thumbColor="#ffffff"
                      />
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* ========================================================= */}
            {/* STEP 6: Royalty Quantity Input Board                      */}
            {/* ========================================================= */}
            {currentStep === 6 && (
              <View style={styles.stepWrapper}>
                <Text style={styles.stepTitle}>Enter Royalty Quantity</Text>
                <View style={styles.numericValueCard}>
                  <Text style={styles.giantValueDisplay}>
                    {royaltyQuantity || "0"}
                  </Text>
                  <Text style={styles.smallUnitDisplay}>m³</Text>
                  {/* <Text style={styles.unitSubscriptText}>ROYALTY UNITS</Text> */}
                </View>
                {renderCustomKeypad()}
              </View>
            )}

            {/* ========================================================= */}
            {/* STEP 7: Royalty Rate Input Board                          */}
            {/* ========================================================= */}
            {currentStep === 7 && (
              <View style={styles.stepWrapper}>
                <Text style={styles.stepTitle}>Enter Royalty Rate</Text>
                <View style={styles.numericValueCard}>
                  <Text style={styles.giantValueDisplay}>
                    ₹ {royaltyRate || "0"}
                  </Text>
                </View>

                {/* <View style={styles.liveSubtotalRow}>
                  <Text style={styles.liveSubtotalLabel}>
                    Royalty Subtotal:
                  </Text>
                  <Text style={styles.liveSubtotalValue}>
                    ₹
                    {Number(
                      (Number(royaltyQuantity) || 0) *
                        (Number(royaltyRate) || 0),
                    ).toLocaleString("en-IN")}
                  </Text>
                </View> */}

                {renderCustomKeypad()}
              </View>
            )}

            {/* ========================================================= */}
            {/* STEP 8: Payment Mode Selection Track                      */}
            {/* ========================================================= */}
            {currentStep === 8 && (
              <View style={styles.stepWrapper}>
                <Text style={styles.stepTitle}>Select Payment Mode</Text>

                <View style={styles.segmentToggleTrack}>
                  <TouchableOpacity
                    style={[
                      styles.toggleSegmentButton,
                      paymentMode === "CASH" && styles.toggleSegmentActiveCash,
                    ]}
                    onPress={() => setPaymentMode("CASH")}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.toggleSegmentLabel,
                        paymentMode === "CASH" && styles.toggleLabelActiveLight,
                      ]}
                    >
                      CASH
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.toggleSegmentButton,
                      paymentMode === "CREDIT" &&
                        styles.toggleSegmentActiveCredit,
                    ]}
                    onPress={() => {
                      setPaymentMode("CREDIT");
                      setAmountPaid(""); // Safe reset instead of static string "0" to prevent user wiping cycles
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.toggleSegmentLabel,
                        paymentMode === "CREDIT" &&
                          styles.toggleLabelActiveLight,
                      ]}
                    >
                      CREDIT
                    </Text>
                  </TouchableOpacity>
                </View>

                {isRateSettled && (
                  <View
                    style={[
                      styles.totalHighlightBlock,
                      {
                        marginTop: 24,
                        padding: 16,
                        borderRadius: 12,
                        backgroundColor: "#f8fafc",
                        borderWidth: 1,
                        borderColor: "#e2e8f0",
                      },
                    ]}
                  >
                    {/* 1. Base Material Subtotal Row */}
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          color: "#64748b",
                          fontWeight: "500",
                        }}
                      >
                        Material Cost:
                      </Text>
                      <Text
                        style={{
                          fontSize: 14,
                          color: "#334155",
                          fontWeight: "600",
                        }}
                      >
                        ₹
                        {Number(
                          (Number(materialQuantity) || 0) *
                            (Number(materialRate) || 0),
                        ).toLocaleString("en-IN")}
                      </Text>
                    </View>

                    {/* 2. Royalty Subtotal Row (Conditionally rendered ONLY if greater than zero) */}
                    {hasRoyalty &&
                      Number(royaltyQuantity) * Number(royaltyRate) > 0 && (
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            marginBottom: 12,
                            paddingBottom: 8,
                            borderBottomWidth: 1,
                            borderBottomColor: "#e2e8f0",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              color: "#64748b",
                              fontWeight: "500",
                            }}
                          >
                            Royalty Pass Fees:
                          </Text>
                          <Text
                            style={{
                              fontSize: 14,
                              color: "#334155",
                              fontWeight: "600",
                            }}
                          >
                            + ₹
                            {Number(
                              (Number(royaltyQuantity) || 0) *
                                (Number(royaltyRate) || 0),
                            ).toLocaleString("en-IN")}
                          </Text>
                        </View>
                      )}

                    {/* 3. Combined Grand Total Sum Highlight */}
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: 4,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: "#1e293b",
                        }}
                      >
                        Total Ticket Invoice Balance
                      </Text>
                      <Text
                        style={{
                          fontSize: 18,
                          fontWeight: "800",
                          color: "#4338ca",
                        }}
                      >
                        ₹{Number(grandTotal).toLocaleString("en-IN")}
                      </Text>
                    </View>
                  </View>
                )}

                {/* <View style={styles.infoWarningBox}>
                  <Text style={styles.infoWarningText}>
                    {paymentMode === "CASH"
                      ? "✓ Clerk will be prompted to enter cash collection on the next screen."
                      : "✓ Balance will be added directly to the customer's outstanding credit ledger account balance."}
                  </Text>
                </View> */}
              </View>
            )}

            {/* ========================================================= */}
            {/* STEP 9: Gate Cash Collection Input Board                  */}
            {/* ========================================================= */}
            {currentStep === 9 && paymentMode === "CASH" && (
              <View style={styles.stepWrapper}>
                <Text style={{ ...styles.stepTitle, marginBottom: 8 }}>
                  Enter Cash Received
                </Text>

                <View style={styles.numericValueCard}>
                  <Text style={styles.giantValueDisplay}>
                    ₹ {amountPaid || "0"}
                  </Text>
                </View>

                {isRateSettled && (
                  <View style={styles.liveSubtotalRow}>
                    <Text style={styles.liveSubtotalLabel}>
                      Remaining Balance:
                    </Text>
                    <Text
                      style={[
                        styles.liveSubtotalValue,
                        {
                          color:
                            Number(grandTotal) - (Number(amountPaid) || 0) < 0
                              ? "#dc2626"
                              : "#16a34a",
                          fontWeight: "700",
                        },
                      ]}
                    >
                      ₹
                      {Number(
                        Number(grandTotal) - (Number(amountPaid) || 0),
                      ).toLocaleString("en-IN")}
                    </Text>
                  </View>
                )}

                {renderCustomKeypad()}
              </View>
            )}

            {/* ========================================================= */}
            {/* STEP 10: Clean Read-Only Final Review Summary             */}
            {/* ========================================================= */}
            {currentStep === 10 && (
              <View style={styles.stepWrapper}>
                <Text style={styles.stepTitle}>Review Ticket Summary</Text>
                <View style={styles.summaryBox}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Customer:</Text>
                    <Text style={styles.summaryVal}>{customerName}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Vehicle:</Text>
                    <Text style={styles.summaryVal}>
                      {vehicleNumber.toUpperCase()}
                    </Text>
                  </View>
                  {site && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Site:</Text>
                      <Text style={styles.summaryVal}>{site || "N/A"}</Text>
                    </View>
                  )}
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Material:</Text>
                    <Text style={styles.summaryVal}>
                      {materials.find(
                        (m) =>
                          m.id === selectedMaterial ||
                          m.name === selectedMaterial,
                      )?.name || selectedMaterial}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Material Quantity:</Text>
                    <Text
                      style={[
                        styles.summaryVal,
                        { color: "#0284c7", fontWeight: "600" },
                      ]}
                    >
                      {materialQuantity} ft³
                    </Text>
                  </View>
                  {/* <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Rate Status:</Text>
                    <Text
                      style={[
                        styles.summaryVal,
                        {
                          color: isRateSettled ? "#16a34a" : "#ea580c",
                          fontWeight: "700",
                        },
                      ]}
                    >
                      {isRateSettled ? "SETTLED" : "OPEN (Pending)"}
                    </Text>
                  </View> */}

                  {isRateSettled && (
                    <>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Material Rate:</Text>
                        <Text style={styles.summaryVal}>
                          ₹{Number(materialRate).toLocaleString("en-IN")}/ft³
                        </Text>
                      </View>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Material Cost:</Text>
                        <Text style={styles.summaryVal}>
                          ₹
                          {Number(
                            Number(materialQuantity) * Number(materialRate),
                          ).toLocaleString("en-IN")}
                        </Text>
                      </View>
                    </>
                  )}
                  {hasRoyalty && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Royalty Booking:</Text>
                      <Text style={styles.summaryVal}>
                        ₹
                        {Number(
                          Number(royaltyQuantity) * Number(royaltyRate),
                        ).toLocaleString("en-IN")}{" "}
                        ({royaltyQuantity} m³)
                      </Text>
                    </View>
                  )}
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Grand Total:</Text>
                    <Text
                      style={[
                        styles.summaryVal,
                        { fontWeight: "700", color: "#4338ca" },
                      ]}
                    >
                      ₹{Number(grandTotal).toLocaleString("en-IN")}
                    </Text>
                  </View>

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Payment Track:</Text>
                    <Text style={[styles.summaryVal, { fontWeight: "600" }]}>
                      {paymentMode}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Gate Cash Received:</Text>
                    <Text
                      style={[
                        styles.summaryVal,
                        { color: "#16a34a", fontWeight: "700" },
                      ]}
                    >
                      ₹
                      {Number(
                        paymentMode === "CASH" ? amountPaid : 0,
                      ).toLocaleString("en-IN")}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Bottom Navigation Control Ribbon */}
        <View style={styles.actionNavRow}>
          {currentStep > 0 ? (
            <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
              <ArrowBigLeft color="#475569" size={20} />
              <Text style={styles.backBtnText}> Back</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}

          {currentStep < 10 ? (
            <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
              <Text style={styles.nextBtnText}>Next </Text>
              <ArrowBigRight color={"#ffffff"} size={20} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.commitBtn}
              onPress={handleFinalCommit}
            >
              <SaveCheck color={"#ffffff"} size={20} />
              <Text style={styles.commitBtnText}>Save</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={printModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleCloseAndClear}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              {printStep === "customer" ? "Customer Copy" : "Plant Copy"}
            </Text>

            <View style={styles.ticketPreview}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <View style={styles.previewRow}>
                  <Text style={{ ...styles.previewLabel, width: 30 }}>No.</Text>
                  <Text style={{ marginRight: 8, color: "#64748B" }}>:</Text>
                  <Text style={styles.previewValue}>
                    #{finalTicketRecord?.receiptNumber}
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewValue}>
                    {finalTicketRecord?.businessDate
                      ? new Date(finalTicketRecord.businessDate).toLocaleString(
                          "en-IN",
                          {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          },
                        )
                      : "/"}
                  </Text>
                </View>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Buyer</Text>
                <Text style={{ marginRight: 8, color: "#64748B" }}>:</Text>
                <Text style={styles.previewValue}>
                  {finalTicketRecord?.customerName}
                </Text>
              </View>

              {finalTicketRecord.site && (
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Site</Text>
                  <Text style={{ marginRight: 8, color: "#64748B" }}>:</Text>
                  <Text style={styles.previewValue}>
                    {finalTicketRecord?.site}
                  </Text>
                </View>
              )}

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Material</Text>
                <Text style={{ marginRight: 8, color: "#64748B" }}>:</Text>
                <Text style={styles.previewValue}>
                  {finalTicketRecord?.materialName}
                </Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Quantity</Text>
                <Text style={{ marginRight: 8, color: "#64748B" }}>:</Text>
                <Text style={styles.previewValue}>
                  {Number(
                    finalTicketRecord?.materialQuantity || 0,
                  ).toLocaleString("en-IN")}{" "}
                </Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Time</Text>
                <Text style={{ marginRight: 8, color: "#64748B" }}>:</Text>
                <Text style={styles.previewValue}>
                  {finalTicketRecord?.createdAt
                    ? new Date(finalTicketRecord.createdAt).toLocaleString(
                        "en-IN",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )
                    : "-"}
                </Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Vehicle</Text>
                <Text style={{ marginRight: 8, color: "#64748B" }}>:</Text>
                <Text style={styles.previewValue}>
                  {finalTicketRecord?.vehicleNumber}
                </Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>P. Mode</Text>
                <Text style={{ marginRight: 8, color: "#64748B" }}>:</Text>
                <Text style={styles.previewValue}>
                  {finalTicketRecord?.paymentMode === "CASH" ? "CSH" : "CRD"}
                </Text>
              </View>

              {finalTicketRecord.hasRoyalty && (
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Royalty</Text>
                  <Text style={{ marginRight: 8, color: "#64748B" }}>:</Text>
                  <Text style={styles.previewValue}>
                    {finalTicketRecord?.royaltyQuantity}
                  </Text>
                </View>
              )}
            </View>
            <BluetoothPrintButton
              title={printStep === "customer" ? "Customer Copy" : "Plant Copy"}
              transactionData={finalTicketRecord}
              copyType={printStep}
              onPrintComplete={handlePrintCompleted}
            />

            {/* Backup skip button if the paper rolls jam or the printer runs out of battery */}
            <TouchableOpacity
              onPress={handleCloseAndClear}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={22} color="#64748B" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // MAIN SCENE LAYOUT
  container: {
    flex: 1,
    backgroundColor: "#ffffff", // Pure canvas background
    padding: 24,
  },

  // ELEGANT MINIMAL PROGRESS TIMELINE
  progressContainer: {
    marginBottom: 32,
  },
  progressText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94a3b8", // Crisp, muted slate
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  progressBarBg: {
    height: 2,
    backgroundColor: "#f1f5f9", // Razor-thin structural track
    marginTop: 8,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#0f172a", // Solid master anchor
  },

  // EXECUTIVE MASTER WORKSPACE FRAME
  cardFrame: {
    flexGrow: 1,
    backgroundColor: "#ffffff",
    justifyContent: "space-between",
    paddingBottom: 2,
  },
  stepWrapper: {
    flex: 1,
    width: "100%",
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: -0.5,
    marginBottom: 20,
  },

  // PREMIUM UNDERLINE INPUT ARCHITECTURE
  fieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  formInput: {
    width: "100%",
    backgroundColor: "transparent",
    borderBottomWidth: 1.5,
    borderColor: "#cbd5e1", // Elegant bottom-border layout only
    fontSize: 20,
    color: "#0f172a",
    fontWeight: "700",
    paddingVertical: 8,
    paddingHorizontal: 2,
    marginBottom: 32,
  },

  // ASYMMETRICAL SELECTION GRID MATRIX
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    width: "100%",
  },
  gridCard: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: "flex-start", // Left-aligned metrics feel significantly cleaner
    marginBottom: 16,
  },
  gridCardSelected: {
    backgroundColor: "#f8fafc",
    borderColor: "#0f172a",
    borderWidth: 2,
  },
  gridCardIcon: {
    fontSize: 20,
    marginBottom: 12,
  },
  gridCardLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
  gridCardLabelSelected: {
    color: "#0f172a",
    fontWeight: "800",
  },

  // MONOLITH VALUE DISPLAY UNITS
  giantValueDisplay: {
    fontSize: 54,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: -1,
    textAlign: "left",
    paddingHorizontal: 12,
    marginBottom: 10,
  },

  smallUnitDisplay: {
    fontSize: 30,
    fontWeight: "900",
    color: "#535559",
  },
  // HIGH-DENSITY TACTILE KEYPAD
  keypadContainer: {
    width: "100%",
    marginTop: 16,
  },
  keypadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  keypadBtn: {
    flex: 1,
    height: 56,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#f1f5f9", // Invisible/soft borders until action
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 6,
  },
  keypadBtnWide: {
    width: "100%",
  },
  keypadActionBtn: {
    backgroundColor: "#f8fafc",
    borderWidth: 0,
  },
  keypadBtnText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#0f172a",
  },

  // HIGH-END INVOICE STYLE SUMMARY MANIFEST
  summaryBox: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#0f172a", // Sandwiched layout lines
    paddingVertical: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  summaryVal: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },

  // NAVIGATION BAR COHESION RAIL
  actionNavRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 2,
    // marginTop: 16,
  },
  backBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: "transparent",
  },
  backBtnText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  nextBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 0,
    gap: 5,
  },
  nextBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  commitBtn: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#0f172a",
    paddingVertical: 14,
    paddingHorizontal: 36,
  },
  commitBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // DATA SELECT DROPDOWN ELEMENT
  dropdownStepContainer: {
    paddingVertical: 12,
    width: "100%",
  },
  miniLoaderWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1.5,
    borderColor: "#cbd5e1",
    paddingVertical: 10,
    height: 44,
  },
  miniLoaderText: {
    fontSize: 13,
    color: "#94a3b8",
  },
  dropdownRelativeAnchor: {
    position: "relative",
    width: "100%",
    height: 44,
    marginTop: 6,
  },

  // PREMIUM FLAT EMBEDDED SEGMENT TRACKER
  toggleStepContainer: {
    paddingVertical: 16,
    width: "100%",
  },
  segmentToggleTrack: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 4,
    height: 48,
    marginTop: 0,
    marginBottom: 20,
    width: "100%",
  },
  toggleSegmentButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // CRISP HIGH-CONTRAST SELECTION INVERSION
  toggleSegmentActiveCash: {
    backgroundColor: "#0f172a", // Rich deep space slate focus selection block
  },
  toggleSegmentActiveCredit: {
    backgroundColor: "#0f172a",
  },
  toggleSegmentLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  toggleLabelActiveLight: {
    color: "#ffffff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    width: "88%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",

    borderWidth: 1,
    borderColor: "#E2E8F0",

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B", // Deep slate primary text
    marginBottom: 8,
    textAlign: "center",
  },
  modalSub: {
    fontSize: 15,
    color: "#64748B",
    marginBottom: 28,
    textAlign: "center",
  },
  skipButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: "100%",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0", // Light border line
    backgroundColor: "#F8FAFC", // Subtle off-white contrast surface
  },
  skipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
  },
  closeButton: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 18,
  },
  ticketPreview: {
    width: "100%",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 16,
    marginBottom: 24,
  },

  previewRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 2,
  },

  previewLabel: {
    width: 60,
    fontSize: 14,
    color: "#64748B",
    fontWeight: "600",
  },

  flex: 1,
  marginLeft: 20,
  textAlign: "right",
  emptyMaterialsContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },

  emptyMaterialsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },

  emptyMaterialsSubtitle: {
    marginTop: 8,
    marginBottom: 24,
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
  numericValueCard: {
    // backgroundColor: "#f8fafc",
    // borderRadius: 12,
    // borderWidth: 1,
    // borderColor: "#e2e8f0",
    flexDirection: "row",
    paddingVertical: 2,
    paddingHorizontal: 16,
    alignItems: "baseline",
    justifyContent: "flex-start",
    gap: 10,
    // marginVertical: 12,
  },
  unitSubscriptText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: 1,
    marginTop: 4,
    textTransform: "uppercase",
  },
  centeredToggleBox: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginVertical: 16,
  },
  largeInstructionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    textAlign: "center",
    marginBottom: 8,
  },
  inlineToggleContainer: {
    alignItems: "center",
    marginTop: 8,
  },
  toggleStatusText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  liveSubtotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
    marginBottom: 1,
  },
  liveSubtotalLabel: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
  liveSubtotalValue: {
    fontSize: 16,
    color: "#334155",
    fontWeight: "600",
  },
  infoSuccessBox: {
    backgroundColor: "#f0fdf4",
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  infoSuccessText: {
    color: "#16a34a",
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  infoWarningBox: {
    backgroundColor: "#fff7ed",
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ffedd5",
    // marginTop: 12,
  },
  infoWarningText: {
    color: "#ea580c",
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  totalHighlightBlock: {
    backgroundColor: "#e0e7ff",
    padding: 14,
    borderRadius: 8,
    alignItems: "stretch",
    marginVertical: 12,
  },
  totalBlockLabel: {
    fontSize: 12,
    color: "#4338ca",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  totalBlockValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1e1b4b",
    marginTop: 2,
  },
  balanceSummaryNote: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
    fontStyle: "italic",
  },
});

const pickerStyles = {
  nativeWebSelectElement: {
    width: "100%",
    height: "44px",
    backgroundColor: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    padding: "0 36px 0 12px",
    fontSize: "14px",
    fontWeight: "600",
    color: "#0f172a",
    outline: "none",
    cursor: "pointer",
    appearance: "none", // Strips away default browser rendering bugs
    WebkitAppearance: "none",
    MozAppearance: "none",
    fontFamily: "sans-serif",
  },
  chevronDecorationIconPointer: {
    position: "absolute",
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
};
