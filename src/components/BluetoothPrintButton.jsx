import { Printer, PrinterCheck, PrinterX } from "lucide-react-native";
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
  Modal,
  FlatList,
} from "react-native";
import RNBluetoothClassic from "react-native-bluetooth-classic";
import { usePrinter } from "../context/PrinterContext";

export default function BluetoothPrintButton({
  title = "RECEIPT COPY",
  transactionData,
  copyType = "plant",
  onPrintComplete,
  showPrinterSelectorButton = false,
  showPrintButton = true,
  onOpenPrinterSelector,
}) {
  const [isPrinting, setIsPrinting] = useState(false);
  const {
    selectedPrinter,
    setSelectedPrinter,
    discoveredDevices,
    isScanning,
    deviceModalVisible,
    setDeviceModalVisible,
    startDeviceDiscovery,
    selectPrinter,
    clearSelectedPrinter,
    closeDeviceModal,
  } = usePrinter();

  const openDeviceDiscovery = async () => {
    await startDeviceDiscovery();
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
    const lineWidth = 32;

    const leftRight = (left, right) => {
      const spaces = Math.max(1, lineWidth - left.length - right.length);
      return left + " ".repeat(spaces) + right + "\n";
    };

    let receipt = "";
    receipt += initializePrinter;

    // Header Setup
    receipt += centerAlign + boldOn + doubleSizeOn;
    receipt += "TICKET" + newline;
    receipt += doubleSizeOff + boldOff;
    receipt += horizontalLine;

    // Structural Ledger Details
    receipt += leftAlign;
    receipt += leftRight(
      `No. : #${data?.receiptNumber || "N/A"}`,
      `${
        data?.businessDate
          ? new Date(data.businessDate).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })
          : "N/A"
      }`,
    );
    receipt += `Buyer    : ${data?.customerName || "N/A"}\n`;
    if (data.site) receipt += `Site     : ${data?.site || "N/A"}\n`;
    receipt += `Material : ${data?.materialName || "N/A"}\n`;
    receipt += `Quantity : ${data?.materialQuantity || "N/A"}\n`;
    receipt += `Time     : ${
      data?.createdAt
        ? new Date(data.createdAt).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : "N/A"
    }`;
    receipt += newline;
    receipt += `Vehicle  : ${data?.vehicleNumber || "N/A"}\n`;
    receipt += `P.Mode   : ${(data?.paymentMode === "CASH" ? "CSH" : "CRD") || "N/A"}\n`;
    if (data.hasRoyalty)
      receipt += `R.MR     : ${data?.royaltyQuantity || "N/A"}\n`;
    receipt += horizontalLine;
    receipt += newline + newline;
    receipt += leftRight("D. S.", "P. S.");
    receipt += newline + newline + newline;

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

  const ensurePrinterIsPaired = async (printer) => {
    if (!printer?.address) {
      throw new Error("Printer address is missing.");
    }

    const bondedDevices = await RNBluetoothClassic.getBondedDevices();
    const existingBondedPrinter = bondedDevices.find(
      (device) => device.address === printer.address,
    );

    if (existingBondedPrinter?.bonded) {
      return existingBondedPrinter;
    }

    Alert.alert(
      "Pairing Required",
      `Please accept the Bluetooth pairing prompt for ${printer.name || "the printer"} on your phone.`,
    );

    return RNBluetoothClassic.pairDevice(printer.address);
  };

  const handlePrinterSelection = (printer) => {
    selectPrinter(printer);
  };

  const openPrinterSelector = () => {
    if (onOpenPrinterSelector) {
      onOpenPrinterSelector();
      return;
    }

    openDeviceDiscovery();
  };

  const handlePrintSequence = async (printer = selectedPrinter) => {
    const granted = await requestBluetoothPermissions();
    if (!granted) {
      Alert.alert(
        "Permission Required",
        "Bluetooth permissions are required to print receipts.",
      );
      return;
    }

    if (typeof RNBluetoothClassic?.isBluetoothEnabled !== "function") {
      Alert.alert("Bluetooth Error", "Native Bluetooth module is not loaded.");
      return;
    }
    if (!transactionData) {
      Alert.alert("Error", "No valid tracking ledger data loaded to print.");
      return;
    }

    const printerToUse = printer ?? selectedPrinter;

    if (!printerToUse) {
      Alert.alert(
        "No Printer Selected",
        "Please select a printer first or tap Change Printer to choose one.",
        [{ text: "Select Printer", onPress: openDeviceDiscovery }],
      );
      return;
    }

    setIsPrinting(true);

    try {
      const isBluetoothEnabled = await RNBluetoothClassic.isBluetoothEnabled();

      if (!isBluetoothEnabled) {
        try {
          await RNBluetoothClassic.requestBluetoothEnabled();

          // Give Android a moment to enable the adapter
          await new Promise((resolve) => setTimeout(resolve, 1000));
          if (!printer) {
            openDeviceDiscovery();

            return;
          }
        } catch {
          Alert.alert(
            "Bluetooth Required",
            "Bluetooth must be enabled to print.",
          );
          return;
        }
      }

      let targetPrinter;
      try {
        targetPrinter = await ensurePrinterIsPaired(printerToUse);
      } catch (error) {
        clearSelectedPrinter();
        Alert.alert(
          "Printer Not Paired",
          error?.message || "The selected printer could not be paired.",
          [
            {
              text: "Scan Printers",
              onPress: openDeviceDiscovery,
            },
          ],
        );
        return;
      }

      if (!targetPrinter?.address) {
        Alert.alert(
          "Printer Not Available",
          "The selected printer could not be prepared for printing.",
        );
        return;
      }

      console.log("Target printer:");
      console.log(JSON.stringify(targetPrinter, null, 2));

      console.log("typeof isConnected =", typeof targetPrinter.isConnected);
      console.log("typeof connect =", typeof targetPrinter.connect);
      console.log("typeof write =", typeof targetPrinter.write);
      console.log("typeof disconnect =", typeof targetPrinter.disconnect);
      console.log("targetPrinter =", targetPrinter);
      console.log("targetPrinter exists?", !!targetPrinter);

      if (!targetPrinter) {
        Alert.alert("Debug", "targetPrinter is undefined");
        return;
      }
      let isConnected = await targetPrinter.isConnected();

      if (!isConnected) {
        console.log(
          "Opening an Insecure RFCOMM Serial pipe to bypass handshake timeouts...",
        );
        isConnected = await targetPrinter.connect({
          connectorType: "rfcomm",
          secure: false,
        });
      }

      if (isConnected) {
        console.log(
          "Insecure channel anchored. Waiting for stream to settle...",
        );
        await new Promise((resolve) => setTimeout(resolve, 600));

        console.log("Formatting and printing data packets...");
        const formattedPrintJob = generateEscPosString(title, transactionData);

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
      console.error("PRINT ERROR:", error);

      if (error?.stack) {
        console.error(error.stack);
      }

      Alert.alert(
        "Printer Not Found",
        "Make sure that the printer is turned ON and in close proximity.",
      );
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      {showPrintButton ? (
        <TouchableOpacity
          style={[
            copyType === "plant"
              ? { backgroundColor: "orange" }
              : { backgroundColor: "green" },
            styles.button,
            isPrinting &&
              (copyType === "plant"
                ? { backgroundColor: "#f2d68f" }
                : { backgroundColor: "#A7F3D0" }),
            ,
          ]}
          onPress={() => handlePrintSequence(selectedPrinter)}
          disabled={isPrinting}
          activeOpacity={0.7}
        >
          {isPrinting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.buttonText}>Print {title}</Text>
          )}
        </TouchableOpacity>
      ) : null}

      {showPrinterSelectorButton ? (
        <TouchableOpacity
          style={styles.changeButton}
          onPress={openPrinterSelector}
          activeOpacity={0.7}
        >
          {selectedPrinter ? (
            <PrinterCheck color={"#b6d7a8"} size={20} />
          ) : (
            <PrinterX color={"#ea9999"} size={20} />
          )}
        </TouchableOpacity>
      ) : null}
      {/* Bluetooth Device Management Control Panel Modal */}
      <Modal
        visible={deviceModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.scannerOverlay}>
          <View style={styles.scannerContainer}>
            <Text style={styles.scannerTitle}>Bluetooth Printer Setup</Text>

            {isScanning && (
              <ActivityIndicator
                size="small"
                color="#1E3A8A"
                style={{ marginBottom: 10 }}
              />
            )}

            <FlatList
              data={discoveredDevices}
              keyExtractor={(item) => item.address}
              style={{ width: "100%", maxHeight: 250 }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  No paired or local peripherals found. Tap Rescan below.
                </Text>
              }
              renderItem={({ item }) => {
                const hasRealName =
                  item.name &&
                  item.name.trim() !== "" &&
                  item.name !== item.address;
                return (
                  <TouchableOpacity
                    style={[
                      styles.deviceRow,
                      selectedPrinter?.address === item.address &&
                        styles.selectedDeviceRow,
                    ]}
                    onPress={() => {
                      handlePrinterSelection(item);

                      console.log(
                        `Active printer assigned profile: ${item.name} [${item.address}]`,
                      );
                    }}
                  >
                    <View>
                      <Text>{hasRealName ? item.name : "Unknown Device"}</Text>
                    </View>
                    {selectedPrinter?.address === item.address && (
                      <Text style={styles.activeBadge}>Active</Text>
                    )}
                  </TouchableOpacity>
                );
              }}
            />

            <View style={styles.modalActionGroup}>
              <TouchableOpacity
                style={styles.rescanBtn}
                onPress={startDeviceDiscovery}
                disabled={isScanning}
              >
                <Text style={styles.rescanBtnText}>
                  {isScanning ? "Scanning..." : "Rescan Devices"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={closeDeviceModal}
              >
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    // backgroundColor: "#228B22",
    borderWidth: 1,
    alignSelf: "flex-start",
    // borderColor: "green",
    borderWidth: 0,
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
  changeButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  changeButtonText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
  },
  scannerOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  scannerContainer: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    // borderRadius: 16,
    padding: 20,
    alignItems: "center",
    elevation: 10,
  },
  scannerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 16,
  },
  deviceRow: {
    width: "100%",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectedDeviceRow: {
    backgroundColor: "#EFF6FF",
    // borderRadius: 8,
    borderColor: "#3B82F6",
  },
  deviceName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#334155",
  },
  deviceAddress: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  activeBadge: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
  },
  emptyText: {
    textAlign: "center",
    color: "#64748B",
    fontSize: 14,
    marginVertical: 20,
  },
  modalActionGroup: {
    flexDirection: "row",
    marginTop: 20,
    gap: 10,
    width: "100%",
  },
  rescanBtn: {
    flex: 2,
    backgroundColor: "#2563EB",
    paddingVertical: 12,
    // borderRadius: 8,
    alignItems: "center",
  },
  rescanBtnText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  closeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingVertical: 12,
    // borderRadius: 8,
    alignItems: "center",
  },
  closeBtnText: {
    color: "#64748B",
    fontWeight: "600",
    fontSize: 14,
  },
});
