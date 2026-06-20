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
  const [grossWeight, setGrossWeight] = useState("");
  const [tareWeight, setTareWeight] = useState("");

  // Live Math Output States
  const [netWeight, setNetWeight] = useState(0);
  const [totalBill, setTotalBill] = useState(0);
  const RATE_PER_TON = 450.0;

  const STORAGE_CACHE_KEY = "@mandar_crusher_materials_cache";

  useEffect(() => {
    async function loadMaterials() {
      try {
        console.log(
          "📡 Attempting live synchronization with material registry...",
        );
        const response = await apiClient.get("/api/materials/clerk");
        const arr = response.data?.data || response.data || [];

        if (Array.isArray(arr) && arr.length > 0) {
          setMaterials(arr);
          setSelectedMaterial(arr[0].id || arr[0].name);

          // 🌟 CACHE IMMUTABLY: Save to hardware disk storage for offline boot sequences
          await AsyncStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(arr));
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

  // Compute metrics automatically
  useEffect(() => {
    const gross = Number(grossWeight) || 0;
    const tare = Number(tareWeight) || 0;
    const net = Math.max(0, gross - tare);
    setNetWeight(net);
    setTotalBill(Math.round((net / 1000) * RATE_PER_TON * 100) / 100);
  }, [grossWeight, tareWeight]);

  const handleKeypadPress = (val) => {
    const targetState = currentStep === 2 ? grossWeight : tareWeight;
    const setter = currentStep === 2 ? setGrossWeight : setTareWeight;

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
      if (!vehicleNumber.trim())
        return Alert.alert(
          "Required Field",
          "Please enter the Vehicle Number.",
        );
      if (!customerName.trim())
        return Alert.alert("Required Field", "Please enter the Customer Name.");
      Keyboard.dismiss();
    }
    if (currentStep === 1 && !selectedMaterial) {
      return Alert.alert(
        "Required Field",
        "Please select a material type to continue.",
      );
    }
    if (currentStep === 2 && !grossWeight)
      return Alert.alert("Required Field", "Please enter Gross Weight.");
    if (currentStep === 3) {
      if (!tareWeight)
        return Alert.alert("Required Field", "Please enter Tare Weight.");
      if (Number(tareWeight) >= Number(grossWeight)) {
        return Alert.alert(
          "Metrics Conflict",
          "Tare weight cannot exceed or equal Gross weight.",
        );
      }
    }
    setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => setCurrentStep((prev) => Math.max(0, prev - 1));

  const handleFinalCommit = async () => {
    const uniqueReceiptNo = `MC-${Date.now().toString().slice(-6)}`;
    const matObj = materials.find(
      (m) => m.id === selectedMaterial || m.name === selectedMaterial,
    );

    const finalTicketRecord = {
      receiptNumber: uniqueReceiptNo,
      shiftId: shiftId,
      clerkId: clerk?.id,
      vehicleNumber: vehicleNumber.trim().toUpperCase(),
      customerName: customerName.trim(),
      materialName: matObj?.name || selectedMaterial,
      materialId: selectedMaterial,
      grossWeight: Number(grossWeight),
      tareWeight: Number(tareWeight),
      netWeight: netWeight,
      totalAmount: totalBill,
      createdAt: new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      }),
      synced: false,
    };

    try {
      await appendNewTicket(finalTicketRecord);
      Alert.alert(
        "Success ✅",
        `Ticket ${uniqueReceiptNo} saved successfully!`,
      );
      setVehicleNumber("");
      setCustomerName("");
      setGrossWeight("");
      setTareWeight("");
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
      <View style={styles.cardFrame}>
        {/* STEP 0: Identity Profile */}
        {currentStep === 0 && (
          <View style={styles.stepWrapper}>
            <Text style={styles.stepTitle}>Freight Identity Profile</Text>

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

            <Text style={styles.fieldLabel}>Customer / Account Name</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g. Mandar Logistics"
              placeholderTextColor="#94a3b8"
              value={customerName}
              onChangeText={setCustomerName}
            />
          </View>
        )}

        {/* STEP 1: UPGRADED Material Selection Grid */}
        {currentStep === 1 && (
          <View style={[styles.stepWrapper, { flex: 1 }]}>
            <Text style={styles.stepTitle}>Select Material Type</Text>
            {isMaterialsLoading ? (
              <ActivityIndicator
                size="large"
                color="#0f172a"
                style={{ marginTop: 40 }}
              />
            ) : (
              <ScrollView
                contentContainerStyle={styles.gridContainer}
                showsVerticalScrollIndicator={false}
              >
                {materials.map((m) => {
                  const isSelected =
                    selectedMaterial === m.id || selectedMaterial === m.name;
                  return (
                    <TouchableOpacity
                      key={m.id || m.name}
                      style={[
                        styles.gridCard,
                        isSelected && styles.gridCardSelected,
                      ]}
                      onPress={() => setSelectedMaterial(m.id || m.name)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.gridCardIcon}>{m.icon || "📦"}</Text>
                      <Text
                        style={[
                          styles.gridCardLabel,
                          isSelected && styles.gridCardLabelSelected,
                        ]}
                      >
                        {m.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}

        {/* STEP 2: Gross Weight */}
        {currentStep === 2 && (
          <View style={styles.stepWrapper}>
            <Text style={styles.stepTitle}>Gross Weight (Loaded KG)</Text>
            <Text style={styles.giantValueDisplay}>{grossWeight || "0"}</Text>
            {renderCustomKeypad()}
          </View>
        )}

        {/* STEP 3: Tare Weight */}
        {currentStep === 3 && (
          <View style={styles.stepWrapper}>
            <Text style={styles.stepTitle}>
              Permanent Tare Weight (Empty KG)
            </Text>
            <Text style={styles.giantValueDisplay}>{tareWeight || "0"}</Text>
            {renderCustomKeypad()}
          </View>
        )}

        {/* STEP 4: Ticket Summary Overview */}
        {currentStep === 4 && (
          <View style={styles.stepWrapper}>
            <Text style={styles.stepTitle}>Review Ticket Summary</Text>
            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Vehicle:</Text>
                <Text style={styles.summaryVal}>
                  {vehicleNumber.toUpperCase()}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Customer:</Text>
                <Text style={styles.summaryVal}>{customerName}</Text>
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
                <Text style={styles.summaryLabel}>Net Cargo:</Text>
                <Text style={[styles.summaryVal, { color: "#0284c7" }]}>
                  {netWeight.toLocaleString("en-IN")} KG
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Bill:</Text>
                <Text style={[styles.summaryVal, { color: "#16a34a" }]}>
                  ₹{totalBill.toLocaleString("en-IN")}
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

          {currentStep < 4 ? (
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
});
