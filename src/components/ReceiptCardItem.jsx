import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import {
  CloudSync,
  CloudOff,
  Ban,
  CloudCheck,
  Delete,
  Trash,
  Dot,
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

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: 2,
        }}
      >
        <Text style={styles.subText}>
          {new Date(item.businessDate).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
        </Text>

        <Dot size={14} color="#666666" />

        <Text style={styles.subText}>
          {new Date(item.createdAt).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>

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

      {item.site && (
        <View style={styles.row}>
          <Text style={styles.label}>Site:</Text>
          <Text style={[styles.value, isVoided && styles.lineThrough]}>
            {item.site}
          </Text>
        </View>
      )}

      <View style={styles.row}>
        <Text style={styles.label}>Material:</Text>
        <Text style={[styles.value, isVoided && styles.lineThrough]}>
          {item.materialName || "N/A"}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Material Qty:</Text>
        <Text style={[styles.value, isVoided && styles.lineThrough]}>
          {item.materialQuantity || "0"} ft³
        </Text>
      </View>
      {item.materialRate > 0 && (
        <View>
          <View style={styles.row}>
            <Text style={styles.label}>Material Rate:</Text>
            <Text style={[styles.value, isVoided && styles.lineThrough]}>
              ₹{Number(item.materialRate).toLocaleString("en-IN")}/ft³
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Material Cost:</Text>
            <Text style={[styles.value, isVoided && styles.lineThrough]}>
              ₹
              {Number(
                Number(item.materialQuantity) * Number(item.materialRate),
              ).toLocaleString("en-IN")}
            </Text>
          </View>
          {item.hasRoyalty && (
            <View style={styles.row}>
              <Text style={styles.label}>Royalty Booking:</Text>
              <Text style={[styles.value, isVoided && styles.lineThrough]}>
                ₹
                {Number(
                  Number(item.royaltyQuantity) * Number(item.royaltyRate),
                ).toLocaleString("en-IN")}{" "}
                ({item.royaltyQuantity} m³)
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.row}>
        <Text style={styles.label}>Payment Type:</Text>
        <Text style={[styles.value, isVoided && styles.lineThrough]}>
          {item.paymentMode || "CASH"}
        </Text>
      </View>
      {item.paymentMode === "CASH" && (
        <View style={styles.row}>
          <Text style={styles.label}>Amount Paid:</Text>
          <Text
            style={[
              styles.summaryVal,
              { fontWeight: "700", color: "#4338ca" },
              isVoided && styles.lineThrough,
            ]}
          >
            ₹{Number(item.amountPaid).toLocaleString("en-IN")}
          </Text>
        </View>
      )}
      {!item.materialRate && (
        <View style={styles.row}>
          <Text style={styles.label}>Rate Status:</Text>
          <Text style={[styles.value, isVoided && styles.lineThrough]}>
            OPEN
          </Text>
        </View>
      )}

      <View style={styles.divider} />

      {/* FINANCIAL DATA TOTAL */}
      {/* <View style={styles.row}>
        <Text style={styles.boldText}>Total Amount:</Text>
        <Text style={styles.boldText}>
          ₹{isVoided ? "0.00" : Number(item. || 0).toFixed(2)}
        </Text>
      </View> */}

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
            copyType="customer"
          />
          <BluetoothPrintButton
            title="Plant Copy"
            transactionData={item}
            copyType="plant"
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
