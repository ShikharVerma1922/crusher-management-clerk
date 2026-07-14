import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export default function MaterialDropdown({
  materials,
  selectedMaterial,
  setSelectedMaterial,
  isMaterialsLoading,
}) {
  return (
    <View style={styles.materialSection}>
      <Text style={styles.sectionHeaderLabel}>Material Type</Text>

      {isMaterialsLoading ? (
        <View style={styles.loaderFrame}>
          <Text style={styles.loaderText}>Syncing aggregate listings...</Text>
        </View>
      ) : (
        <View style={styles.gridMatrix}>
          {materials &&
            materials.map((material) => {
              // Works perfectly whether materials is an array of strings or objects
              const materialName =
                typeof material === "object" ? material.name : material;
              const materialId =
                typeof material === "object" ? material.id : material;

              const isSelected = selectedMaterial === materialId;

              return (
                <TouchableOpacity
                  key={materialId}
                  style={[
                    styles.gridCellButton,
                    isSelected && styles.gridCellActive,
                  ]}
                  onPress={() => setSelectedMaterial(materialId)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.gridCellText,
                      isSelected && styles.gridCellTextActive,
                    ]}
                  >
                    {materialName}
                  </Text>
                </TouchableOpacity>
              );
            })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  materialSection: {
    width: "100%",
    marginBottom: 28,
  },
  sectionHeaderLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },
  gridMatrix: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    width: "100%",
  },
  gridCellButton: {
    width: "31.5%",
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  gridCellActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  gridCellText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  gridCellTextActive: {
    color: "#ffffff",
    fontWeight: "800",
  },
  loaderFrame: {
    paddingVertical: 12,
    paddingHorizontal: 2,
    borderBottomWidth: 1.5,
    borderColor: "#e2e8f0",
  },
  loaderText: {
    fontSize: 14,
    color: "#94a3b8",
    fontWeight: "600",
  },
});
