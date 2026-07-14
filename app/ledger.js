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
import { useLedger } from "../src/context/LedgerContext.js";
import { useAuth } from "../src/context/AuthContext.js";
import { TicketCard } from "../src/components/ReceiptCardItem.jsx";
import BluetoothPrintButton from "../src/components/BluetoothPrintButton.jsx";
import {
  Box,
  Boxes,
  DoorClosedLocked,
  LogOut,
  Package,
  Receipt,
  ReceiptText,
} from "lucide-react-native";

export default function LedgerHistoryScreen() {
  const { transactions, voidTransactionTicket } = useLedger();

  const { logout, clerk } = useAuth();

  // Modal Control States
  const [reasonModalVisible, setReasonModalVisible] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);

  // 📝 Standard Auditable Void Reasons for Weighbridge Operations
  const VOID_REASONS = [
    "Operator Typo / Input Mistake",
    "Duplicate Ticket Generated",
    "Wrong Material Selected",
    "Payment not made",
    "Order cancelled",
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

  const handleInitiateVoidFlow = (ticketId, receiptNumber) => {
    setSelectedTicket({
      id: ticketId,
      receiptNumber,
    });
    setReasonModalVisible(true);
  };

  const handleSelectReasonAndExecute = async (reason) => {
    if (!selectedTicket) return;

    setReasonModalVisible(false);

    try {
      await voidTransactionTicket(selectedTicket.id, reason);

      Alert.alert(
        "Log Invalidated ❌",
        `Receipt ${selectedTicket.receiptNumber} successfully flagged as void.`,
      );
    } catch (err) {
      Alert.alert("Operation Error", "Could not invalidate target file.");
    } finally {
      setSelectedTicket(null);
    }
  };

  return (
    <View style={styles.screenContainer}>
      <View style={styles.adminControlHeaderBar}>
        <View style={styles.headerActionsRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <ReceiptText size={18} style={styles.adminHeaderSubtitle} />
            <Text style={styles.adminHeaderSubtitle}>
              {transactions.filter((transaction) => !transaction.isVoid).length}
              {" Records"}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.headerLogoutBtn}
            onPress={handlePressCloseShift}
          >
            <Text>Logout</Text>
            <LogOut size={18} color={"#475569"} />
          </TouchableOpacity>
        </View>
        <View></View>
      </View>

      {transactions.length === 0 ? (
        <View style={styles.emptyStateCenteringWrapper}>
          <Package size={80} color={"#64748b"} />
          <Text style={styles.emptyStateTitle}>Ledger Logs Empty</Text>
          <Text style={styles.emptyStateSubtitle}>
            No trucks have been processed during this active shift session yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) =>
            String(
              item?.id ?? item?.dbId ?? item?.receiptNumber ?? item?.createdAt,
            )
          }
          renderItem={({ item }) => (
            <TicketCard item={item} onVoidTrigger={handleInitiateVoidFlow} />
          )}
          contentContainerStyle={styles.listScrollPaddingWrapper}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* 📋 AUDIT REASON SELECTION SHEET MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={reasonModalVisible}
        onRequestClose={() => {
          setReasonModalVisible(false);
          setSelectedTicket(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentCard}>
            <Text style={styles.modalTitleText}>
              Audit Regulation Requirement
            </Text>
            <Text style={styles.modalSubtitleText}>
              Select the operating reason to void receipt{" "}
              {selectedTicket?.receiptNumber ?? ""}:
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
              onPress={() => {
                setReasonModalVisible(false);
                setSelectedTicket(null);
              }}
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
  // 📱 SCREEN CORE CANVAS
  screenContainer: {
    flex: 1,
    backgroundColor: "#ffffff", // Pure structural canvas
  },
  listScrollPaddingWrapper: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },

  // 🏛️ ADMIN CONTROL MASTER HEADER
  adminControlHeaderBar: {
    flexDirection: "column",
    alignItems: "left",
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
    paddingVertical: 3,
    borderBottomWidth: 1.5,
    borderColor: "#0f172a", // Solid master anchor line
  },
  adminHeaderTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  adminHeaderSubtitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748b",
    // letterSpacing: -0.5,
    marginTop: 2,
  },
  headerActionsRow: {
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  headerLogoutBtn: {
    display: "flex",
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#94a3b8",
    paddingHorizontal: 14,
    paddingVertical: 2,
    borderRadius: 5,
  },
  headerLogoutBtnText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // 🎫 MINIMAL HISTORY LEDGER CARD CONTAINER
  auditCard: {
    backgroundColor: "#ffffff",
    paddingVertical: 18,
    marginBottom: 12,
    borderBottomWidth: 1.5,
    borderColor: "#e2e8f0", // Sandwiched list separating lines
  },
  voidedCardBg: {
    opacity: 0.6, // Soft desaturated state instead of raw colors
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  receiptIdText: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
  },
  voidedTextCrossed: {
    textDecorationLine: "line-through",
    color: "#94a3b8",
  },
  timestampLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },

  // STATUS BADGES
  syncBadge: {
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  syncedBg: {},
  pendingBg: {},
  voidBadgeBorder: {},
  syncStatusText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  syncedText: { color: "#64748b" }, // Subdued minimal state
  pendingText: { color: "#d97706" }, // Clear action required text state
  voidBadgeText: { color: "#b91c1c" },

  // DATA DESCRIPTOR PAIRS
  logisticsIdentityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  vehicleBlock: { flex: 1, marginRight: 12 },
  customerBlock: { flex: 1.5 },
  metaLabelHeader: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  vehiclePlateText: { color: "#0f172a", fontSize: 16, fontWeight: "700" },
  customerDetailText: { color: "#0f172a", fontSize: 15, fontWeight: "600" },

  // MATERIAL LAYOUT PILLS
  materialPillContainer: { width: "100%", marginBottom: 12 },
  materialPillLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  materialBadge: {
    backgroundColor: "transparent",
    alignSelf: "flex-start",
  },
  voidedMaterialBadge: {},
  materialBadgeText: { color: "#0f172a", fontSize: 14, fontWeight: "700" },

  // VOID AUDIT NOTE BANNER
  reasonDisplayBox: {
    backgroundColor: "#fff5f5",
    borderLeftWidth: 3,
    borderLeftColor: "#ef4444",
    padding: 10,
    marginVertical: 8,
  },
  reasonDisplayText: { color: "#991b1b", fontSize: 13, fontWeight: "500" },
  dividerLine: { height: 1, backgroundColor: "#f1f5f9", marginBottom: 12 },

  // QUANTITY STRUCTURAL COLUMNS
  weightsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  weightColumn: { flex: 1 },
  weightLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
  },
  weightValue: { color: "#0f172a", fontSize: 16, fontWeight: "700" },
  netValueHighlight: { color: "#0f172a", fontWeight: "800" },
  unitText: { fontSize: 11, color: "#94a3b8", fontWeight: "500" },

  // RECEPTACLE COMMERCIAL FOOTER STRIP
  cardFooterStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 12,
  },
  voidedFooterStrip: { opacity: 0.5 },
  commercialLabel: { color: "#475569", fontSize: 13, fontWeight: "600" },
  monetaryValueHighlight: { color: "#0f172a", fontSize: 16, fontWeight: "800" },
  voidedMonetaryHighlight: { color: "#94a3b8" },

  // ADMINISTRATIVE INVALIDATION BUTTON PANEL
  voidCardActionButton: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#cc0000",
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  voidCardActionButtonText: {
    color: "#cc0000",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // EMPTY RUNTIME STATES DISPLAY
  emptyStateCenteringWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    marginTop: 0,
  },
  emptyStateIcon: { fontSize: 36, marginBottom: 16, color: "#94a3b8" },
  emptyStateTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptyStateSubtitle: {
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },

  // 📋 EXECUTIVE ACTION MODAL OVERLAY ARCHITECTURE
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)", // Muted architectural background mask
    justifyContent: "flex-end",
  },
  modalContentCard: {
    backgroundColor: "#ffffff",
    borderTopWidth: 2,
    borderColor: "#0f172a", // Master top boundary anchor line
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 40,
  },
  modalTitleText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  modalSubtitleText: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 24,
    fontWeight: "500",
  },
  reasonOptionItem: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderBottomWidth: 1.5, // Employs underline list styling matching forms
  },
  reasonOptionItemText: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "700",
  },
  modalCancelBtn: {
    alignItems: "center",
    marginTop: 16,
    paddingVertical: 12,
  },
  modalCancelBtnText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
