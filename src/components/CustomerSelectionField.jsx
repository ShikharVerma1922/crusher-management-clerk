import React, { useState } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";

export default function CustomerSelectionField({
  customerInputRef,
  customerSearchQuery,
  setCustomerSearchQuery,
  setCustomerName,
  customers,
  isCustomersLoading,
  onCustomerSelected,
}) {
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const toProperCase = (text) =>
    text.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());

  const handleSearch = (text) => {
    const formattedText = toProperCase(text);

    setCustomerSearchQuery(formattedText);
    setCustomerName(formattedText);

    if (!text.trim()) {
      setFilteredCustomers([]);
      setShowDropdown(false);
      return;
    }

    const filtered = customers
      .filter((c) =>
        c.name?.toLowerCase().includes(formattedText.toLowerCase()),
      )
      .slice(0, 5);
    setFilteredCustomers(filtered);
    setShowDropdown(filtered.length > 0);
  };

  const handleSelect = (item) => {
    setCustomerName(item.name);
    setCustomerSearchQuery(item.name);
    setShowDropdown(false);
    if (onCustomerSelected) onCustomerSelected(item);
  };

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>Customer Name</Text>

      <View style={styles.inputAnchor}>
        <TextInput
          ref={customerInputRef}
          style={styles.formInput}
          placeholder={
            isCustomersLoading
              ? "Loading client index..."
              : "Type customer name..."
          }
          placeholderTextColor="#94a3b8"
          value={customerSearchQuery}
          onChangeText={handleSearch}
          onFocus={() => {
            if (
              customerSearchQuery.trim().length > 0 &&
              filteredCustomers.length > 0
            ) {
              setShowDropdown(true);
            }
          }}
          blurOnSubmit={false}
          returnKeyType="next"
          editable={!isCustomersLoading}
        />

        {/* Floating Dropdown Results Menu */}
        {showDropdown && (
          <View style={styles.dropdownOverlay}>
            <ScrollView
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
            >
              {filteredCustomers.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => handleSelect(item)}
                  style={styles.dropdownRow}
                  activeOpacity={0.6}
                >
                  <Text style={styles.dropdownText}>{item.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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

  fieldContainer: { zIndex: 50, width: "100%" },

  inputAnchor: { position: "relative", zIndex: 100, width: "100%" },

  dropdownOverlay: {
    position: "absolute",
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    maxHeight: 180,
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 999,
  },
  dropdownRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  dropdownText: { fontSize: 14, fontWeight: "500", color: "#334155" },
});
