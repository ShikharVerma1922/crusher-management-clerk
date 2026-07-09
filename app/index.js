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
} from "react-native";
import { useAuth } from "../src/context/AuthContext";
import { useLedger } from "../src/context/LedgerContext";
import apiClient from "../src/services/apiClient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialDropdown from "../src/components/MaterialDropdown";
import { generateTicketIdentities } from "../src/utils/idGenerator";
import { apiServices } from "../src/services/apiServices";
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

export default function WeighbridgeWizardScreen() {
  const { clerk, shiftId } = useAuth();
  const { appendNewTicket } = useLedger();

  // 🗺️ Wizard Navigation State (0: Identity Profile, 1: Material Grid, 2: Gross Wt, 3: Tare Wt, 4: Summary)
  const [currentStep, setCurrentStep] = useState(0);

  // Form Input Storage States
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [materials, setMaterials] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [isMaterialsLoading, setIsMaterialsLoading] = useState(true);
  const [quantity, setQuantity] = useState("");
  const [site, setSite] = useState("");
  const [paymentType, setPaymentType] = useState("CASH");
  const [amount, setAmount] = useState("");
  const [finalTicketRecord, setFinalTicketRecord] = useState({});

  const STORAGE_CACHE_KEY = "@mandar_crusher_materials_cache";

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

  useEffect(() => {
    async function loadMaterials() {
      try {
        console.log(
          "📡 Attempting live synchronization with material registry...",
        );
        // const response = await apiClient.get("/materials/clerk");
        const { data, status } = await apiServices.materialList();

        if (Array.isArray(data) && data.length > 0) {
          setMaterials(data);
          setSelectedMaterial(data[0].id || data[0].name);

          // 🌟 CACHE IMMUTABLY: Save to hardware disk storage for offline boot sequences
          await AsyncStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(data));
          console.log(
            "💾 Material matrix successfully cached to local disk storage.",
          );
        } else {
          throw new Error("Empty array payload returned from server.");
        }
      } catch (e) {
        console.log(
          "⚠️ Network down or API failure. Pulling local hardware cache layers...",
        );

        try {
          // Intercept local disk logs
          const cachedStringData =
            await AsyncStorage.getItem(STORAGE_CACHE_KEY);

          if (cachedStringData !== null) {
            const parsedCacheArray = JSON.parse(cachedStringData);
            setMaterials(parsedCacheArray);
            setSelectedMaterial(
              parsedCacheArray[0].id || parsedCacheArray[0].name,
            );
            console.log(
              "✅ Successfully initialized offline workspace via AsyncStorage cache.",
            );
          } else {
            // Bottom-tier fallback if the device has never been online since installation
            console.log(
              "🚨 Zero local cache footprints found. Injecting bootstrap defaults.",
            );
            const bootstrapDefaults = [
              { id: "1", name: "Crushed Stone (10mm)", icon: "🪨" },
              { id: "2", name: "Crushed Stone (20mm)", icon: "🧱" },
              { id: "3", name: "River Sand", icon: "⏳" },
              { id: "4", name: "Stone Dust", icon: "💨" },
            ];
            setMaterials(bootstrapDefaults);
            setSelectedMaterial("1");
          }
        } catch (cacheError) {
          console.error(
            "Critical storage corruption reading cache:",
            cacheError,
          );
        }
      } finally {
        setIsMaterialsLoading(false);
      }
    }

    loadMaterials();
  }, []);

  const handleKeypadPress = (val) => {
    const targetState = currentStep === 2 ? quantity : amount;
    const setter = currentStep === 2 ? setQuantity : setAmount;

    if (val === "CLEAR") {
      setter("");
    } else if (val === "BACK") {
      setter(targetState.slice(0, -1));
    } else {
      if (targetState.length < 6) setter(targetState + val);
    }
  };

  const handleNext = () => {
    if (currentStep === 0) {
      if (!customerName.trim())
        return Alert.alert("Required Field", "Please enter the Customer Name.");
      if (!vehicleNumber.trim())
        return Alert.alert(
          "Required Field",
          "Please enter the Vehicle Number.",
        );

      Keyboard.dismiss();
    }
    if (currentStep === 1 && !selectedMaterial) {
      return Alert.alert(
        "Required Field",
        "Please select a material type to continue.",
      );
    }
    if (currentStep === 2 && Number(quantity) <= 0)
      return Alert.alert("Required Field", "Please enter quantity.");

    if (currentStep === 3 && paymentType === "CASH" && Number(amount) <= 0)
      return Alert.alert("Required Field", "Please enter total amount.");

    setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => setCurrentStep((prev) => Math.max(0, prev - 1));

  const handleFinalCommit = async () => {
    const matObj = materials.find(
      (m) => m.id === selectedMaterial || m.name === selectedMaterial,
    );

    const { id, receiptNumber } = await generateTicketIdentities();

    const finalTicket = {
      shiftId: shiftId,
      clerkId: clerk?.id,
      vehicleNumber: vehicleNumber.trim().toUpperCase(),
      customerName: customerName.trim(),
      materialName: matObj?.name || selectedMaterial,
      materialId: selectedMaterial,
      quantity: Number(quantity),
      totalAmount: Number(amount),
      site,
      id,
      receiptNumber: String(receiptNumber),
      paymentType,
      createdAt: new Date().toISOString(),
      synced: false,
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

  const handlePrintCompleted = async () => {
    if (printStep === "customer") {
      setPrintStep("plant");
    } else {
      setPrintModalVisible(false);

      setVehicleNumber("");
      setCustomerName("");
      setAmount("");
      setQuantity("");
      setSite("");
      setPaymentType("CASH");
      setCurrentStep(0);
    }
  };

  const handleCloseAndClear = () => {
    setPrintModalVisible(false);
    setVehicleNumber("");
    setCustomerName("");
    setAmount("");
    setQuantity("");
    setSite("");
    setPaymentType("CASH");
    setCurrentStep(0);
  };

  const renderCustomKeypad = () => (
    <View style={styles.keypadContainer}>
      {[
        ["1", "2", "3"],
        ["4", "5", "6"],
        ["7", "8", "9"],
        [
          { value: "CLEAR", icon: <Trash2 size={22} /> },
          "0",
          { value: "BACK", icon: <Delete size={22} /> },
        ],
      ].map((row, rIdx) => (
        <View key={rIdx} style={styles.keypadRow}>
          {row.map((btn, cIdx) => {
            const isObject = typeof btn === "object";

            return (
              <TouchableOpacity
                key={`${rIdx}-${cIdx}`}
                onPress={() => handleKeypadPress(isObject ? btn.value : btn)}
                style={styles.keypadBtn}
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

  return (
    <View style={styles.container}>
      {/* Step Indicator Top Bar */}
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>STEP {currentStep + 1} OF 5</Text>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${((currentStep + 1) / 5) * 100}%` },
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
        {/* STEP 0: Identity Profile */}
        {currentStep === 0 && (
          <View style={styles.stepWrapper}>
            <Text style={styles.stepTitle}>Fill the information:</Text>

            <Text style={styles.fieldLabel}>Customer Name</Text>
            <TextInput
              ref={customerInputRef}
              style={styles.formInput}
              placeholder="e.g. Mandar Logistics"
              placeholderTextColor="#94a3b8"
              value={customerName}
              onChangeText={setCustomerName}
              onSubmitEditing={() => vehicleInputRef.current?.focus()}
              blurOnSubmit={false}
              returnKeyType="next"
            />

            <Text style={styles.fieldLabel}>Vehicle Number</Text>
            <TextInput
              ref={vehicleInputRef}
              style={styles.formInput}
              placeholder="e.g. MH14EU9999"
              placeholderTextColor="#94a3b8"
              autoCapitalize="characters"
              autoCorrect={false}
              value={vehicleNumber}
              onChangeText={setVehicleNumber}
              onSubmitEditing={() => handleNext()}
              returnKeyType="next"
            />
          </View>
        )}

        {/* STEP 1: Site, Material and Qty */}
        {currentStep === 1 && (
          <View>
            {/* Site */}
            <Text style={styles.fieldLabel}>Site</Text>
            <TextInput
              style={styles.formInput}
              placeholder=""
              placeholderTextColor="#94a3b8"
              autoCorrect={false}
              value={site}
              onChangeText={setSite}
            />
            {/* Material */}
            <MaterialDropdown
              materials={materials}
              selectedMaterial={selectedMaterial}
              setSelectedMaterial={setSelectedMaterial}
              isMaterialsLoading={isMaterialsLoading}
            />
            {/* Quantity */}

            {/* <Text style={styles.stepTitle}>Quantity</Text>
            <Text style={styles.giantValueDisplay}>{quantity || "0"}</Text>
            {renderCustomKeypad()} */}
          </View>
        )}

        {currentStep === 2 && (
          <View style={styles.stepWrapper}>
            <Text style={{ ...styles.stepTitle, marginTop: 0 }}>Quantity</Text>
            <Text style={{ ...styles.giantValueDisplay }}>
              {quantity || "0"}
            </Text>
            {renderCustomKeypad()}
          </View>
        )}

        {/* STEP 2: Payment and Amount */}
        {currentStep === 3 && (
          <View style={styles.stepWrapper}>
            {/* Payment type */}
            <View style={styles.segmentToggleTrack}>
              {/* 💵 CASH OPTION SELECTION SEGMENT */}
              <TouchableOpacity
                style={[
                  styles.toggleSegmentButton,
                  paymentType === "CASH" && styles.toggleSegmentActiveCash,
                ]}
                onPress={() => setPaymentType("CASH")}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.toggleSegmentLabel,
                    paymentType === "CASH" && styles.toggleLabelActiveLight,
                  ]}
                >
                  CASH
                </Text>
              </TouchableOpacity>

              {/* 💳 CREDIT OPTION SELECTION SEGMENT */}
              <TouchableOpacity
                style={[
                  styles.toggleSegmentButton,
                  paymentType === "CREDIT" && styles.toggleSegmentActiveCredit,
                ]}
                onPress={() => setPaymentType("CREDIT")}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.toggleSegmentLabel,
                    paymentType === "CREDIT" && styles.toggleLabelActiveLight,
                  ]}
                >
                  CREDIT
                </Text>
              </TouchableOpacity>
            </View>
            {/* Amount */}
            {/* <Text style={{ ...styles.stepTitle }}>Total Amount</Text> */}
            <Text style={styles.giantValueDisplay}>{amount || "0"}</Text>
            {renderCustomKeypad()}
          </View>
        )}

        {/* STEP 4: Ticket Summary Overview */}
        {currentStep === 4 && (
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

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Site:</Text>
                <Text style={styles.summaryVal}>{site}</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Material:</Text>
                <Text style={styles.summaryVal}>
                  {materials.find(
                    (m) =>
                      m.id === selectedMaterial || m.name === selectedMaterial,
                  )?.name || selectedMaterial}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Quantity:</Text>
                <Text style={[styles.summaryVal, { color: "#0284c7" }]}>
                  {Number(quantity || 0).toLocaleString("en-IN")}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Payment Type:</Text>
                <Text style={[styles.summaryVal]}>{paymentType}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Amount:</Text>
                <Text style={[styles.summaryVal, { color: "#16a34a" }]}>
                  ₹{Number(amount || 0).toLocaleString("en-IN")}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Bottom Navigation Control Ribbon */}
        <View style={styles.actionNavRow}>
          {currentStep > 0 ? (
            <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
              <ArrowBigLeft />
              <Text style={styles.backBtnText}> Back</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}

          {currentStep < 4 ? (
            <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
              <Text style={styles.nextBtnText}>Next</Text>
              <ArrowBigRight color={"#ffffff"} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.commitBtn}
              onPress={handleFinalCommit}
            >
              <SaveCheck color={"#ffffff"} />
              <Text style={styles.commitBtnText}>Save</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={printModalVisible}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              {printStep === "customer"
                ? "Print Customer Copy"
                : "Print Plant Record"}
            </Text>

            {/* <Text style={styles.modalSub}>
              {printStep === "customer"
                ? "Hand off this receipt copy to the truck transit driver."
                : "File this copy into the inner plant weighbridge ledger box."}
            </Text> */}

            <BluetoothPrintButton
              title={printStep === "customer" ? "Customer Copy" : "Plant Copy"}
              transactionData={finalTicketRecord}
              copyType={
                printStep === "customer" ? "Customer Copy" : "Plant Copy"
              }
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
    paddingBottom: 20,
  },
  stepWrapper: {
    flex: 1,
    width: "100%",
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.5,
    marginBottom: 36,
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
    marginBottom: 20,
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
    paddingVertical: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
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
    paddingTop: 24,
    marginTop: 16,
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
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    // borderRadius: 16,
    padding: 24,
    alignItems: "center",
    // High-contrast shadow configuration for sleek depth elevation
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B", // Deep slate primary text
    marginBottom: 8,
    textAlign: "center",
  },
  modalSub: {
    fontSize: 14,
    color: "#64748B", // Neutral cool grey for contextual help details
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 10,
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
