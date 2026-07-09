import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
} from "react-native";
import RNBluetoothClassic from "react-native-bluetooth-classic";

export default function BluetoothPrintButton({
  title = "RECEIPT COPY",
  transactionData,
  copyType,
  onPrintComplete,
}) {
  const [isPrinting, setIsPrinting] = useState(false);

  // Formats text into raw ESC/POS command sequences for a standard 2-inch (58mm) or 3-inch (80mm) thermal printer
  const lineWidth = 32;

  const leftRight = (left, right) => {
    const spaces = Math.max(1, lineWidth - left.length - right.length);
    return left + " ".repeat(spaces) + right + "\n";
  };

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
    const doubleSizeOn = GS + "!" + "\x11";
    const doubleSizeOff = GS + "!" + "\x00";
    const condensedOn = ESC + "\x0F";
    const condensedOff = ESC + "\x12";
    const fontB = ESC + "M" + "\x01";
    const fontA = ESC + "M" + "\x00";
    const horizontalLine = "--------------------------------\n";

    let receipt = "";
    receipt += initializePrinter;

    // Header Setup
    receipt += centerAlign + boldOn + doubleSizeOn;
    receipt += "DELIVERY CHALLAN" + newline;
    receipt += doubleSizeOff + boldOff;
    receipt += horizontalLine;

    // Custom Copy Designation Title Prop
    receipt +=
      boldOn + `*** ${copyTitle.toUpperCase()} ***` + newline + boldOff;
    receipt += horizontalLine;

    // Structural Ledger Details
    receipt += leftAlign;
    receipt += leftRight(
      `No. : ${data?.receiptNumber || "N/A"}`,
      data?.createdAt
        ? new Date(data.createdAt).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })
        : "N/A",
    );
    receipt += `Buyer : ${data?.customerName || "N/A"}\n`;
    receipt += `Site  : ${data?.site || ""}\n`;
    receipt += `Mat.  : ${data?.materialName || "N/A"}\n`;
    receipt += `Qty.  : ${data?.quantity || "N/A"}\n`;
    receipt += `Time  : ${
      data?.createdAt
        ? new Date(data.createdAt).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : "N/A"
    }`;
    receipt += newline;
    receipt += `V. No : ${data?.vehicleNumber || "N/A"}\n`;
    receipt += horizontalLine;
    receipt += fontB;
    // receipt += condensedOn;
    receipt +=
      centerAlign + "Note: No quality guarantee after unloading." + newline;
    // receipt += condensedOff;
    receipt += fontA;
    receipt += newline + newline;
    receipt += leftRight("Driver Sign", "Plant Sign");
    receipt += newline;
    receipt += centerAlign + "Thank You! Drive Safely." + newline;
    receipt += newline + newline + newline + newline;

    return receipt;
  };

  //for android 12+ devices
  const requestBluetoothPermissions = async () => {
    if (Platform.OS !== "android" || Platform.Version < 31) {
      return true;
    }

    const permissions = [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    ];

    const result = await PermissionsAndroid.requestMultiple(permissions);

    return permissions.every(
      (permission) => result[permission] === PermissionsAndroid.RESULTS.GRANTED,
    );
  };

  const handlePrintSequence = async () => {
    const granted = await requestBluetoothPermissions();

    if (!granted) {
      Alert.alert(
        "Permission Required",
        "Bluetooth permissions are required to print receipts.",
      );
      return;
    }
    console.log("Bluetooth Module:", RNBluetoothClassic);

    if (!RNBluetoothClassic?.isBluetoothEnabled) {
      Alert.alert("Bluetooth Error", "Native Bluetooth module is not loaded.");
      return;
    }
    if (!transactionData) {
      Alert.alert("Error", "No valid tracking ledger data loaded to print.");
      return;
    }

    setIsPrinting(true);

    try {
      console.log("temp : ", RNBluetoothClassic);

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
      console.log("Checking paired devices first...");
      let pairedDevices = await RNBluetoothClassic.getBondedDevices();

      let targetPrinter = pairedDevices.find((device) => {
        const name = (device.name || "").toLowerCase();
        return (
          name.includes("printer") ||
          name.includes("pos") ||
          name.includes("mpt") ||
          name.includes("udyama") ||
          name.includes("sr588")
        );
      });

      // 🚀 LIVE SCAN FALLBACK: If not found in paired list, scan the air!
      if (!targetPrinter) {
        console.log(
          "Printer not found in paired devices. Starting live discovery scan...",
        );
        Alert.alert(
          "Scanning",
          "Searching for nearby Udyama printer over the air...",
        );

        try {
          // Scans for unpaired devices nearby for roughly 5-10 seconds
          const discoveredDevices = await RNBluetoothClassic.startDiscovery();
          console.log(`Discovered ${discoveredDevices.length} devices nearby.`);

          targetPrinter = discoveredDevices.find((device) => {
            const name = (device.name || "").toLowerCase();
            return (
              name.includes("printer") ||
              name.includes("pos") ||
              name.includes("mpt") ||
              name.includes("sr588")
            );
          });
        } catch (scanError) {
          console.error("Discovery failed:", scanError);
        }
      }

      if (!targetPrinter) {
        Alert.alert(
          "Printer Missing",
          "Could not find any paired or nearby Bluetooth printers. Make sure the Udyama SR588 is turned on and discoverable.",
        );
        setIsPrinting(false);
        return;
      }

      console.log(
        `Connecting to targeted printer: ${targetPrinter.name} (${targetPrinter.address})`,
      );

      // 3. Establish the socket channel safely
      console.log(
        `Targeting hardware address: ${targetPrinter.name} (${targetPrinter.address})`,
      );

      // 1. Force check if already connected
      let isConnected = await targetPrinter.isConnected();

      if (!isConnected) {
        console.log(
          "Opening an Insecure RFCOMM Serial pipe to bypass handshake timeouts...",
        );

        // 🚀 THE FIX: Pass an options object forcing an INSECURE connection.
        // This tells the native Android Java layer to use 'createInsecureRfcommSocketToServiceRecord',
        // which completely eliminates the 'read failed, socket might closed' error!
        isConnected = await targetPrinter.connect({
          connectorType: "rfcomm",
          secure: false, // <-- This disables the strict hardware handshake requirement
        });
      }

      if (isConnected) {
        console.log(
          "Insecure channel anchored. Waiting for stream to settle...",
        );
        await new Promise((resolve) => setTimeout(resolve, 600));

        console.log("Formatting and printing data packets...");
        const formattedPrintJob = generateEscPosString(
          copyType,
          transactionData,
        );

        await targetPrinter.write(formattedPrintJob);

        console.log("Print byte matrix transmitted successfully!");

        await new Promise((resolve) => setTimeout(resolve, 500));
        await targetPrinter.disconnect();

        onPrintComplete?.();
      } else {
        Alert.alert(
          "Connection Failure",
          "Could not establish a clean serial stream with the target machine.",
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
    alignSelf: "flex-start",
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
