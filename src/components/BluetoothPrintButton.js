import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
} from "react-native";
import RNBluetoothClassic from "react-native-bluetooth-classic";

export default function BluetoothPrintButton({
  title = "RECEIPT COPY",
  transactionData,
}) {
  const [isPrinting, setIsPrinting] = useState(false);

  // Formats text into raw ESC/POS command sequences for a standard 2-inch (58mm) or 3-inch (80mm) thermal printer
  const generateEscPosString = (copyTitle, data) => {
    const ESC = "\x1b";
    const GS = "\x1d";
    const newline = "\n";

    // Command presets
    const initializePrinter = ESC + "@";
    const centerAlign = ESC + "a" + "\x01";
    const leftAlign = ESC + "a" + "\x00";
    const boldOn = ESC + "E" + "\x01";
    const boldOff = ESC + "E" + "\x00";
    const doubleSizeOn = GS + "!" + "\x11"; // Double height and width
    const doubleSizeOff = GS + "!" + "\x00";
    const horizontalLine = "--------------------------------\n"; // 32 chars for 58mm

    let receipt = "";
    receipt += initializePrinter;

    // Header Setup
    receipt += centerAlign + boldOn + doubleSizeOn;
    receipt += "MANDAR ENTERPRISES" + newline;
    receipt += doubleSizeOff + boldOff;
    receipt += "Crusher Ledger Management System" + newline;
    receipt += horizontalLine;

    // Custom Copy Designation Title Prop
    receipt +=
      boldOn + `*** ${copyTitle.toUpperCase()} ***` + newline + boldOff;
    receipt += horizontalLine;

    // Structural Ledger Details
    receipt += leftAlign;
    receipt += `Receipt No : ${data?.receiptNumber || "N/A"}\n`;
    receipt += `Date       : ${data?.createdAt ? new Date(data.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}\n`;
    receipt += `Vehicle No : ${data?.vehicleNumber || "N/A"}\n`;
    receipt += `Customer   : ${data?.customerName || "N/A"}\n`;
    receipt += `Material   : ${data?.materialName || "N/A"}\n`;
    receipt += horizontalLine;

    // Metrics & Computations
    receipt += `Qty Loaded : ${data?.quantity || 0} Tonnes\n`;
    receipt += `Rate Applied: Rs.${data?.rateApplied || 0}/Ton\n`;
    receipt += boldOn;
    receipt += `TOTAL AMT  : Rs.${data?.totalAmount || 0}/-\n`;
    receipt += `Payment    : ${data?.paymentType || "CASH"}\n`;
    receipt += boldOff;
    receipt += horizontalLine;

    // Footer spacing
    receipt += centerAlign + "Thank You! Drive Safely." + newline;
    receipt += newline + newline + newline; // Extra feeds so the user can tear off cleanly

    return receipt;
  };

  const handlePrintSequence = async () => {
    if (!transactionData) {
      Alert.alert("Error", "No valid tracking ledger data loaded to print.");
      return;
    }

    setIsPrinting(true);

    try {
      console.log("tmep : ", RNBluetoothClassic);
      // 1. Check if Bluetooth is powered on
      const isBluetoothEnabled = await RNBluetoothClassic.isBluetoothEnabled();
      if (!isBluetoothEnabled) {
        Alert.alert(
          "Bluetooth Off",
          "Please activate your phone's native Bluetooth antenna.",
        );
        setIsPrinting(false);
        return;
      }

      // 2. Discover paired accessories
      console.log("Scanning paired peripheral devices...");
      const pairedDevices = await RNBluetoothClassic.getBondedDevices();

      const targetPrinter =
        pairedDevices.find((device) => {
          const name = (device.name || "").toLowerCase();

          return (
            name.includes("printer") ||
            name.includes("pos") ||
            name.includes("mpt")
          );
        }) || pairedDevices[0];

      if (!targetPrinter) {
        Alert.alert(
          "Printer Missing",
          "No paired Bluetooth hardware found. Please pair the thermal printer in Android System Settings first.",
        );
        setIsPrinting(false);
        return;
      }

      console.log(
        `Connecting to targeted hardware address: ${targetPrinter.name} (${targetPrinter.address})`,
      );

      // 3. Establish link channel over SPP profile
      let isConnected = await targetPrinter.isConnected();
      if (!isConnected) {
        isConnected = await targetPrinter.connect();
      }

      if (isConnected) {
        console.log("Channel open. Formatting data packets...");
        const formattedPrintJob = generateEscPosString(title, transactionData);

        // 4. Stream raw formatting bytes over the air
        await targetPrinter.write(formattedPrintJob);
        console.log("Print byte matrix transmitted successfully.");

        // Optional: Graceful disconnect to allow other devices to pair up cleanly
        await targetPrinter.disconnect();
      } else {
        Alert.alert(
          "Connection Failure",
          "Could not establish a clean stream handshake with the thermal printer head.",
        );
      }
    } catch (error) {
      console.error(error);
      console.log(JSON.stringify(error, null, 2));
      Alert.alert(
        "Printing Fault",
        `Hardware pipeline exception: ${error.message}`,
      );
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={[styles.button, isPrinting && styles.buttonDisabled]}
        onPress={handlePrintSequence}
        disabled={isPrinting}
        activeOpacity={0.7}
      >
        {isPrinting ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.buttonText}>Print {title}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 1,
  },
  button: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#228B22",
    borderWidth: 1,
    width: "fit-content",
    borderColor: "green",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    backgroundColor: "#A7F3D0",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
});
