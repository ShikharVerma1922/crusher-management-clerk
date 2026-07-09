import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import {
  CloudSync,
  CloudOff,
  Ban,
  CloudCheck,
  Delete,
  Trash,
} from "lucide-react-native";
import BluetoothPrintButton from "./BluetoothPrintButton";

export const TicketCard = ({ item, onVoidTrigger }) => {
  const isVoided = item.isVoid === true;

  return (
    <View style={[styles.cardContainer, isVoided && styles.voidedCard]}>
      {/* HEADER SECTION */}
      <View style={styles.row}>
        <View
          style={{
            flexDirection: "row",
            gap: 10,
            alignItems: "center",
          }}
        >
          <Text style={[styles.boldText, isVoided && styles.lineThrough]}>
            Receipt No: {item.receiptNumber}
          </Text>
          <Text style={styles.text}>
            {isVoided ? (
              <Ban size={18} color={"red"} height={"30px"} />
            ) : item.synced ? (
              <CloudCheck size={18} color={"green"} height={"30px"} />
            ) : (
              <CloudOff size={18} color={"gray"} height={"30px"} />
            )}
          </Text>
        </View>
        {!isVoided && (
          <Trash
            size={20}
            onPress={() =>
              onVoidTrigger(item.id || item.dbId, item.receiptNumber)
            }
            style={{ color: "#f44336" }}
          />
        )}
      </View>

      <Text style={styles.subText}>
        Date: {new Date(item.createdAt).toLocaleString("en-IN")}
      </Text>

      <View style={styles.divider} />

      {/* CORE DETAILS DATA GRID */}
      <View style={styles.row}>
        <Text style={styles.label}>Customer Name:</Text>
        <Text style={[styles.value, isVoided && styles.lineThrough]}>
          {item.customerName || "N/A"}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Vehicle Number:</Text>
        <Text style={[styles.value, isVoided && styles.lineThrough]}>
          {item.vehicleNumber || "N/A"}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Site:</Text>
        <Text style={[styles.value, isVoided && styles.lineThrough]}>
          {item.site || "N/A"}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Material:</Text>
        <Text style={[styles.value, isVoided && styles.lineThrough]}>
          {item.materialName || "N/A"}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Quantity:</Text>
        <Text style={[styles.value, isVoided && styles.lineThrough]}>
          {item.quantity || "0"}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Payment Type:</Text>
        <Text style={[styles.value, isVoided && styles.lineThrough]}>
          {item.paymentType || "CASH"}
        </Text>
      </View>

      <View style={styles.divider} />

      {/* FINANCIAL DATA TOTAL */}
      <View style={styles.row}>
        <Text style={styles.boldText}>Total Amount:</Text>
        <Text style={styles.boldText}>
          ₹{isVoided ? "0.00" : Number(item.totalAmount || 0).toFixed(2)}
        </Text>
      </View>

      {/* VOID METADATA REASON */}
      {isVoided && item.voidReason && (
        <View style={styles.voidReasonBox}>
          <Text style={styles.voidReasonText}>
            Void Reason: {item.voidReason}
          </Text>
        </View>
      )}

      {/* ACTION TRIGGERS */}
      {!isVoided && (
        <View
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <BluetoothPrintButton
            title="Customer Copy"
            transactionData={item}
            copyType="Customer Copy"
          />
          <BluetoothPrintButton
            title="Plant Copy"
            transactionData={item}
            copyType="Plant Copy"
          />
        </View>
      )}
    </View>
  );
};
const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: "#ffffff",
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#cccccc",
  },
  voidedCard: {
    backgroundColor: "#f5f5f5",
    borderColor: "#dddddd",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 3,
  },
  text: {
    fontSize: 13,
    color: "#333333",
  },
  subText: {
    fontSize: 11,
    color: "#666666",
    marginTop: 2,
  },
  label: {
    fontSize: 13,
    color: "#555555",
  },
  value: {
    fontSize: 13,
    fontWeight: "500",
    color: "#000000",
  },
  boldText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000000",
  },
  lineThrough: {
    textDecorationLine: "line-through",
    color: "#888888",
  },
  divider: {
    height: 1,
    backgroundColor: "#eeeeee",
    marginVertical: 8,
  },
  voidReasonBox: {
    marginTop: 8,
    padding: 6,
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fca5a5",
  },
  voidReasonText: {
    fontSize: 12,
    color: "#b91c1c",
    fontWeight: "500",
  },
  button: {
    paddingVertical: 0,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#cc0000",
    fontSize: 13,
    fontWeight: "600",
  },
});
