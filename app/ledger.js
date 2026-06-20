// app/ledger.js
import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
} from "react-native";
import { useLedger } from "../src/context/LedgerContext";
import { useAuth } from "../src/context/AuthContext";

export default function LedgerHistoryScreen() {
  const { transactions, voidTransactionTicket } = useLedger();
  const { logout, clerk } = useAuth();

  // Modal Control States
  const [reasonModalVisible, setReasonModalVisible] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState(null);

  // 📝 Standard Auditable Void Reasons for Weighbridge Operations
  const VOID_REASONS = [
    "Operator Typo / Input Mistake",
    "Truck Left Platform Scale",
    "Wrong Material Selected",
    "Duplicate Ticket Generated",
    "Scale Calibration Discrepancy",
  ];

  const handlePressCloseShift = () => {
    Alert.alert(
      "Close Session? 🚪",
      `Are you sure you want to log out, ${clerk?.name || "Operator"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => await logout(),
        },
      ],
    );
  };

  const handleInitiateVoidFlow = (ticketId) => {
    setSelectedTicketId(ticketId);
    setReasonModalVisible(true);
  };

  const handleSelectReasonAndExecute = async (reason) => {
    setReasonModalVisible(false);
    try {
      await voidTransactionTicket(selectedTicketId, reason);
      Alert.alert(
        "Log Invalidated ❌",
        `Receipt ${selectedTicketId} successfully flagged as void.`,
      );
    } catch (err) {
      Alert.alert("Operation Error", "Could not invalidate target file.");
    } finally {
      setSelectedTicketId(null);
    }
  };

  const renderTicketCardItem = ({ item }) => {
    const isVoided = item.isVoid === true;

    return (
      <View style={[styles.auditCard, isVoided && styles.voidedCardBg]}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text
              style={[
                styles.receiptIdText,
                isVoided && styles.voidedTextCrossed,
              ]}
            >
              {item.id} {isVoided ? "[VOIDED]" : ""}
            </Text>
            <Text style={styles.timestampLabel}>{item.createdAt}</Text>
          </View>
          <View
            style={[
              styles.syncBadge,
              isVoided
                ? styles.voidBadgeBorder
                : item.synced
                  ? styles.syncedBg
                  : styles.pendingBg,
            ]}
          >
            <Text
              style={[
                styles.syncStatusText,
                isVoided
                  ? styles.voidBadgeText
                  : item.synced
                    ? styles.syncedText
                    : styles.pendingText,
              ]}
            >
              {isVoided
                ? "❌ Invalidated"
                : item.synced
                  ? "● Synced"
                  : "⏳ Offline"}
            </Text>
          </View>
        </View>

        <View style={styles.logisticsIdentityRow}>
          <View style={styles.vehicleBlock}>
            <Text style={styles.metaLabelHeader}>Vehicle Number</Text>
            <Text
              style={[
                styles.vehiclePlateText,
                isVoided && styles.voidedTextCrossed,
              ]}
            >
              {item.vehicleNumber}
            </Text>
          </View>
          <View style={styles.customerBlock}>
            <Text style={styles.metaLabelHeader}>Customer Account</Text>
            <Text
              style={[
                styles.customerDetailText,
                isVoided && styles.voidedTextCrossed,
              ]}
              numberOfLines={1}
            >
              {item.customerName}
            </Text>
          </View>
        </View>

        <View style={styles.materialPillContainer}>
          <Text style={styles.materialPillLabel}>Material Type</Text>
          <View
            style={[
              styles.materialBadge,
              isVoided && styles.voidedMaterialBadge,
            ]}
          >
            <Text style={styles.materialBadgeText}>
              🧱 {item.materialName || "Unclassified Aggregate"}
            </Text>
          </View>
        </View>

        {/* Display Void Reason Inline if Flagged */}
        {isVoided && item.voidReason && (
          <View style={styles.reasonDisplayBox}>
            <Text style={styles.reasonDisplayText}>
              ⚠️ Reason: {item.voidReason}
            </Text>
          </View>
        )}

        <View style={styles.dividerLine} />

        <View style={styles.weightsGrid}>
          <View style={styles.weightColumn}>
            <Text style={styles.weightLabel}>Gross Weight</Text>
            <Text
              style={[styles.weightValue, isVoided && styles.voidedTextCrossed]}
            >
              {item.grossWeight.toLocaleString("en-IN")}{" "}
              <Text style={styles.unitText}>kg</Text>
            </Text>
          </View>
          <View style={styles.weightColumn}>
            <Text style={styles.weightLabel}>Tare Weight</Text>
            <Text
              style={[styles.weightValue, isVoided && styles.voidedTextCrossed]}
            >
              {item.tareWeight.toLocaleString("en-IN")}{" "}
              <Text style={styles.unitText}>kg</Text>
            </Text>
          </View>
          <View style={styles.weightColumn}>
            <Text
              style={[
                styles.weightLabel,
                isVoided ? styles.weightLabel : { color: "#0284c7" },
              ]}
            >
              Net Cargo
            </Text>
            <Text
              style={[
                styles.weightValue,
                isVoided ? styles.voidedTextCrossed : styles.netValueHighlight,
              ]}
            >
              {isVoided
                ? "0"
                : (item.grossWeight - item.tareWeight).toLocaleString(
                    "en-IN",
                  )}{" "}
              <Text style={styles.unitText}>kg</Text>
            </Text>
          </View>
        </View>

        <View
          style={[styles.cardFooterStrip, isVoided && styles.voidedFooterStrip]}
        >
          <Text style={styles.commercialLabel}>Total Cash Settlement</Text>
          <Text
            style={[
              styles.monetaryValueHighlight,
              isVoided && styles.voidedMonetaryHighlight,
            ]}
          >
            ₹{isVoided ? "0.00" : item.totalAmount.toLocaleString("en-IN")}
          </Text>
        </View>

        {!isVoided && (
          <TouchableOpacity
            style={styles.voidCardActionButton}
            onPress={() => handleInitiateVoidFlow(item.id)}
          >
            <Text style={styles.voidCardActionButtonText}>
              ⚠️ Void & Invalidate Receipt Log
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.screenContainer}>
      <View style={styles.adminControlHeaderBar}>
        <View>
          <Text style={styles.adminHeaderTitle}>SHIFT LOGS LEDGER</Text>
          <Text style={styles.adminHeaderSubtitle}>
            {transactions.length} Active Records
          </Text>
        </View>
        <TouchableOpacity
          style={styles.headerLogoutBtn}
          onPress={handlePressCloseShift}
        >
          <Text style={styles.headerLogoutBtnText}>🚪 Close Shift</Text>
        </TouchableOpacity>
      </View>

      {transactions.length === 0 ? (
        <View style={styles.emptyStateCenteringWrapper}>
          <Text style={styles.emptyStateIcon}>📦</Text>
          <Text style={styles.emptyStateTitle}>Ledger Logs Empty</Text>
          <Text style={styles.emptyStateSubtitle}>
            No trucks have been processed during this active shift session yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={renderTicketCardItem}
          contentContainerStyle={styles.listScrollPaddingWrapper}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* 📋 AUDIT REASON SELECTION SHEET MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={reasonModalVisible}
        onRequestClose={() => setReasonModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentCard}>
            <Text style={styles.modalTitleText}>
              Audit Regulation Requirement
            </Text>
            <Text style={styles.modalSubtitleText}>
              Select the official operating reason to void ticket{" "}
              {selectedTicketId}:
            </Text>

            {VOID_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={styles.reasonOptionItem}
                onPress={() => handleSelectReasonAndExecute(reason)}
              >
                <Text style={styles.reasonOptionItemText}>↳ {reason}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setReasonModalVisible(false)}
            >
              <Text style={styles.modalCancelBtnText}>Dismiss Request</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: { flex: 1, backgroundColor: "#f8fafc" },
  listScrollPaddingWrapper: { padding: 16, paddingBottom: 32 },
  adminControlHeaderBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
  },
  adminHeaderTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 0.8,
  },
  adminHeaderSubtitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 2,
  },
  headerLogoutBtn: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fca5a5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  headerLogoutBtnText: { color: "#dc2626", fontSize: 12, fontWeight: "700" },
  auditCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  voidedCardBg: { backgroundColor: "#f1f5f9", borderColor: "#cbd5e1" },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  receiptIdText: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  voidedTextCrossed: { textDecorationLine: "line-through", color: "#94a3b8" },
  timestampLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  syncBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  syncedBg: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  pendingBg: { backgroundColor: "#fffbeb", borderColor: "#fef3c7" },
  voidBadgeBorder: { backgroundColor: "#fef2f2", borderColor: "#fca5a5" },
  syncStatusText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  syncedText: { color: "#16a34a" },
  pendingText: { color: "#d97706" },
  voidBadgeText: { color: "#dc2626" },
  logisticsIdentityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  vehicleBlock: { flex: 1, marginRight: 12 },
  customerBlock: { flex: 1.2 },
  metaLabelHeader: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  vehiclePlateText: { color: "#0f172a", fontSize: 16, fontWeight: "800" },
  customerDetailText: { color: "#475569", fontSize: 15, fontWeight: "700" },
  materialPillContainer: { width: "100%", marginBottom: 12 },
  materialPillLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  materialBadge: {
    backgroundColor: "#f1f5f9",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  voidedMaterialBadge: { backgroundColor: "#e2e8f0", borderColor: "#cbd5e1" },
  materialBadgeText: { color: "#334155", fontSize: 13, fontWeight: "700" },
  reasonDisplayBox: {
    backgroundColor: "#fee2e2",
    borderRadius: 6,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#fca5a5",
  },
  reasonDisplayText: { color: "#991b1b", fontSize: 13, fontWeight: "700" },
  dividerLine: { height: 1, backgroundColor: "#f1f5f9", marginBottom: 14 },
  weightsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  weightColumn: { flex: 1 },
  weightLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
  },
  weightValue: { color: "#334155", fontSize: 15, fontWeight: "800" },
  netValueHighlight: { color: "#0284c7", fontSize: 16 },
  unitText: { fontSize: 11, color: "#94a3b8", fontWeight: "600" },
  cardFooterStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  voidedFooterStrip: { backgroundColor: "#e2e8f0", borderColor: "#cbd5e1" },
  commercialLabel: { color: "#475569", fontSize: 13, fontWeight: "700" },
  monetaryValueHighlight: { color: "#16a34a", fontSize: 18, fontWeight: "900" },
  voidedMonetaryHighlight: { color: "#94a3b8" },
  voidCardActionButton: {
    marginTop: 14,
    borderStyle: "dashed",
    borderWidth: 1.5,
    borderColor: "#f87171",
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#fff5f5",
  },
  voidCardActionButtonText: {
    color: "#dc2626",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  emptyStateCenteringWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    marginTop: 100,
  },
  emptyStateIcon: { fontSize: 44, marginBottom: 12 },
  emptyStateTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
  },
  emptyStateSubtitle: {
    color: "#64748b",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },

  // 📋 Modal Sheet Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  modalContentCard: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitleText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 6,
  },
  modalSubtitleText: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 20,
    fontWeight: "500",
  },
  reasonOptionItem: {
    backgroundColor: "#f8fafc",
    borderFrankWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  reasonOptionItemText: { color: "#334155", fontSize: 14, fontWeight: "700" },
  modalCancelBtn: { alignItems: "center", marginTop: 14, paddingVertical: 12 },
  modalCancelBtnText: { color: "#64748b", fontSize: 14, fontWeight: "700" },
});
