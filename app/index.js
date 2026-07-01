// app/index.js
import React, { useState, useEffect } from "react";
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
} from "react-native";
import { useAuth } from "../src/context/AuthContext";
import { useLedger } from "../src/context/LedgerContext";
import apiClient from "../src/services/apiClient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialDropdown from "../src/components/MaterialDropdown";
import { generateTicketIdentities } from "../src/utils/idGenerator";
import { apiServices } from "../src/services/apiServices";

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

  const STORAGE_CACHE_KEY = "@mandar_crusher_materials_cache";

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
    const targetState = currentStep === 1 ? quantity : amount;
    const setter = currentStep === 1 ? setQuantity : setAmount;

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
    if (currentStep === 1) {
      if (!selectedMaterial)
        return Alert.alert(
          "Required Field",
          "Please select a material type to continue.",
        );
      if (Number(quantity) <= 0)
        return Alert.alert("Required Field", "Please enter the quantity.");
    }
    if (currentStep === 2 && Number(amount) <= 0)
      return Alert.alert("Required Field", "Please enter total amount.");

    setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => setCurrentStep((prev) => Math.max(0, prev - 1));

  const handleFinalCommit = async () => {
    const matObj = materials.find(
      (m) => m.id === selectedMaterial || m.name === selectedMaterial,
    );

    const { id, receiptNumber } = await generateTicketIdentities();

    const finalTicketRecord = {
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

    try {
      await appendNewTicket(finalTicketRecord);
      Alert.alert("Success ✅", `Ticket ${receiptNumber} saved successfully!`);
      setVehicleNumber("");
      setCustomerName("");
      setAmount("");
      setQuantity("");
      setSite("");
      setPaymentType("CASH");
      setCurrentStep(0);
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
        ["CLEAR", "0", "BACK"],
      ].map((row, rIdx) => (
        <View key={rIdx} style={styles.keypadRow}>
          {row.map((btn) => (
            <TouchableOpacity
              key={btn}
              style={[
                styles.keypadBtn,
                (btn === "CLEAR" || btn === "BACK") && styles.keypadActionBtn,
              ]}
              onPress={() => handleKeypadPress(btn)}
            >
              <Text style={styles.keypadBtnText}>{btn}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Step Indicator Top Bar */}
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>STEP {currentStep + 1} OF 4</Text>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${((currentStep + 1) / 4) * 100}%` },
            ]}
          />
        </View>
      </View>

      {/* Main Form Step Core Card Wrapper */}
      <View style={styles.cardFrame}>
        {/* STEP 0: Identity Profile */}
        {currentStep === 0 && (
          <View style={styles.stepWrapper}>
            <Text style={styles.stepTitle}>Freight Identity Profile</Text>

            <Text style={styles.fieldLabel}>Customer Name</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g. Mandar Logistics"
              placeholderTextColor="#94a3b8"
              value={customerName}
              onChangeText={setCustomerName}
            />

            <Text style={styles.fieldLabel}>Vehicle Number</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g. MH14EU9999"
              placeholderTextColor="#94a3b8"
              autoCapitalize="characters"
              autoCorrect={false}
              value={vehicleNumber}
              onChangeText={setVehicleNumber}
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

            <Text style={styles.stepTitle}>Quantity</Text>
            <Text style={styles.giantValueDisplay}>{quantity || "0"}</Text>
            {renderCustomKeypad()}
          </View>
        )}

        {/* STEP 2: Payment and Amount */}
        {currentStep === 2 && (
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
            <Text style={styles.stepTitle}>Total Amount</Text>
            <Text style={styles.giantValueDisplay}>{amount || "0"}</Text>
            {renderCustomKeypad()}
          </View>
        )}

        {/* STEP 3: Ticket Summary Overview */}
        {currentStep === 3 && (
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
              <Text style={styles.backBtnText}>⬅️ Back</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}

          {currentStep < 3 ? (
            <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
              <Text style={styles.nextBtnText}>Next ➡️</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.commitBtn}
              onPress={handleFinalCommit}
            >
              <Text style={styles.commitBtnText}>💾 Confirm & Save</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9", padding: 20 },
  progressContainer: { marginBottom: 16 },
  progressText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 1,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "#cbd5e1",
    borderRadius: 3,
    marginTop: 6,
    overflow: "hidden",
  },
  progressBarFill: { height: "100%", backgroundColor: "#0f172a" },
  cardFrame: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 24,
    justifyContent: "space-between",
  },
  stepWrapper: { flex: 1, width: "100%", alignItems: "center", paddingTop: 10 },
  stepTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#64748b",
    marginBottom: 20,
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "center",
  },
  fieldLabel: {
    width: "100%",
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
    textTransform: "uppercase",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  formInput: {
    width: "100%",
    backgroundColor: "#f8fafc",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    fontSize: 18,
    color: "#0f172a",
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },

  // 🪨 Grid Styling Matrix Block
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    width: "100%",
    paddingBottom: 10,
  },
  gridCard: {
    width: "48%",
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
    padding: 16,
    alignItems: "center",
    marginBottom: 14,
    minHeight: 100,
    justifyContent: "center",
  },
  gridCardSelected: { backgroundColor: "#eff6ff", borderColor: "#2563eb" }, // Royal blue border matching high contrast requirements
  gridCardIcon: { fontSize: 28, marginBottom: 8 },
  gridCardLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
    textAlign: "center",
  },
  gridCardLabelSelected: { color: "#1e40af" },

  giantValueDisplay: {
    fontSize: 46,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#e2e8f0",
    width: "100%",
    textAlign: "center",
    paddingBottom: 8,
    letterSpacing: 1,
  },
  keypadContainer: { width: "100%", maxWidth: 320, marginTop: 10 },
  keypadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  keypadBtn: {
    flex: 1,
    height: 54,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 4,
    elevation: 1,
  },
  keypadActionBtn: { backgroundColor: "#e2e8f0" },
  keypadBtnText: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  summaryBox: {
    width: "100%",
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
  },
  summaryVal: { fontSize: 16, fontWeight: "900", color: "#0f172a" },
  actionNavRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 16,
    marginTop: 10,
  },
  backBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  backBtnText: { color: "#475569", fontSize: 14, fontWeight: "700" },
  nextBtn: {
    backgroundColor: "#0f172a",
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 6,
  },
  nextBtnText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  commitBtn: {
    backgroundColor: "#16a34a",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 6,
  },
  commitBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  dropdownStepContainer: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    backgroundColor: "transparent",
    width: "100%",
  },
  miniLoaderWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f1f5f9",
    padding: 10,
    borderRadius: 8,
    height: 44,
  },
  miniLoaderText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  dropdownRelativeAnchor: {
    position: "relative",
    width: "100%",
    height: 44,
    marginTop: 6,
  },
  toggleStepContainer: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    width: "100%",
  },
  segmentToggleTrack: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0", // Clean tracking groove background
    borderRadius: 8,
    padding: 3,
    height: 44,
    marginTop: 6,
    width: "100%",
  },
  toggleSegmentButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 6,
    transition: "all 0.15s ease-in-out",
  },

  // Dynamic Activation Background Rules
  toggleSegmentActiveCash: {
    backgroundColor: "#16a34a", // Emerald Green for immediate cash recognition
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  toggleSegmentActiveCredit: {
    backgroundColor: "#2563eb", // Royal Blue for corporate credit files
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },

  // Label Typography Styles
  toggleSegmentLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    letterSpacing: 0.5,
  },
  toggleLabelActiveLight: {
    color: "#ffffff", // Pops clean text contrast over the colored states
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
