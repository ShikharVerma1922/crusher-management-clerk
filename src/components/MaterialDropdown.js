import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";

export default function MaterialDropdown({
  materials,
  selectedMaterial,
  setSelectedMaterial,
  isMaterialsLoading,
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Find the currently active object matching selection state
  const currentSelectedObject = materials.find(
    (m) => m.id === selectedMaterial || m.name === selectedMaterial,
  );

  const handleSelect = (item) => {
    setSelectedMaterial(item.id || item.name);
    setIsOpen(false);
  };

  if (isMaterialsLoading) {
    return (
      <View style={styles.miniLoaderWrapper}>
        <ActivityIndicator size="small" color="#2563eb" />
        <Text style={styles.miniLoaderText}>Syncing product grades...</Text>
      </View>
    );
  }

  return (
    <View style={styles.dropdownStepContainer}>
      <Text style={styles.stepTitle}>Material Classification</Text>

      {/* 🎛️ DROPDOWN BOX HEADER TRIGGER */}
      <TouchableOpacity
        style={[
          styles.dropdownTriggerBox,
          isOpen && styles.dropdownTriggerBoxOpen,
        ]}
        onPress={() => setIsOpen(!isOpen)}
        activeOpacity={0.8}
      >
        <Text style={styles.dropdownTriggerText}>
          {currentSelectedObject
            ? `${currentSelectedObject.icon || "📦"}  ${currentSelectedObject.name.toUpperCase()}`
            : "-- Select Material Type --"}
        </Text>
        <Text style={styles.chevronText}>{isOpen ? "▲" : "▼"}</Text>
      </TouchableOpacity>

      {/* 🌊 EXPANDABLE CONTAINER EXPANSION SLOT */}
      {isOpen && (
        <View style={styles.dropdownFloatingDrawer}>
          <FlatList
            data={materials}
            keyExtractor={(item) => item.id || item.name}
            nestedScrollEnabled={true} // Prevents conflict if your main layout is inside a ScrollView
            style={{ maxHeight: 200 }} // Prevents long lists from bleeding off-screen
            renderItem={({ item }) => {
              const isItemActive =
                selectedMaterial === item.id || selectedMaterial === item.name;
              return (
                <TouchableOpacity
                  style={[
                    styles.dropdownItemRow,
                    isItemActive && styles.dropdownItemRowActive,
                  ]}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.itemRowText,
                      isItemActive && styles.itemRowTextActive,
                    ]}
                  >
                    {item.icon || "📦"} &nbsp; {item.name.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}
    </View>
  );
}

// 🎨 HIGH-DENSITY MOBILE STYLES MATRIX
const styles = StyleSheet.create({
  dropdownStepContainer: {
    paddingVertical: 10,
    width: "100%",
    position: "relative", // Critical for keeping the floating drawer anchored
    zIndex: 5000, // Keeps menu above neighboring weight text inputs
  },
  stepTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  dropdownTriggerBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    height: 44,
    paddingHorizontal: 12,
  },
  dropdownTriggerBoxOpen: {
    borderColor: "#2563eb",
    borderBottomLeftRadius: 0, // Creates an uninterrupted seamless card look
    borderBottomRightRadius: 0,
  },
  dropdownTriggerText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  chevronText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "bold",
  },

  // 🚀 THE FLOATING EXPANSION DRAWER
  dropdownFloatingDrawer: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#2563eb",
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4, // Smooth drop shadows on Android scale screens
  },
  dropdownItemRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  dropdownItemRowActive: {
    backgroundColor: "#eff6ff",
  },
  itemRowText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  itemRowTextActive: {
    color: "#2563eb",
    fontWeight: "700",
  },

  // Loader States
  miniLoaderWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 12,
    borderRadius: 8,
    height: 44,
    marginTop: 18,
  },
  miniLoaderText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
});
