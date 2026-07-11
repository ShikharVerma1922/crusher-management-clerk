import React, { createContext, useContext, useState } from "react";
import { Alert, PermissionsAndroid, Platform } from "react-native";
import RNBluetoothClassic from "react-native-bluetooth-classic";

const PrinterContext = createContext(null);

export const PrinterProvider = ({ children }) => {
  const [selectedPrinter, setSelectedPrinter] = useState(null);
  const [discoveredDevices, setDiscoveredDevices] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [deviceModalVisible, setDeviceModalVisible] = useState(false);

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

  const startDeviceDiscovery = async () => {
    const granted = await requestBluetoothPermissions();
    if (!granted) {
      Alert.alert(
        "Permission Denied",
        "Bluetooth scanning requires system permissions.",
      );
      return;
    }

    try {
      const isBluetoothEnabled = await RNBluetoothClassic.isBluetoothEnabled();

      if (!isBluetoothEnabled) {
        try {
          await RNBluetoothClassic.requestBluetoothEnabled();
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch {
          Alert.alert(
            "Bluetooth Required",
            "Please enable Bluetooth to print.",
          );
          return;
        }
      }

      setIsScanning(true);
      setDeviceModalVisible(true);
      setDiscoveredDevices([]);

      const bonded = await RNBluetoothClassic.getBondedDevices();
      setDiscoveredDevices(bonded);

      const discovered = await RNBluetoothClassic.startDiscovery();

      setDiscoveredDevices((prev) => {
        const allDevices = [...prev, ...discovered];
        return allDevices.filter(
          (device, index, self) =>
            self.findIndex((d) => d.address === device.address) === index,
        );
      });
    } catch (error) {
      console.error("Discovery error:", error);
    } finally {
      setIsScanning(false);
    }
  };

  const selectPrinter = (printer) => {
    setSelectedPrinter(printer);
    setDeviceModalVisible(false);
  };

  const clearSelectedPrinter = () => {
    setSelectedPrinter(null);
  };

  const closeDeviceModal = () => {
    setDeviceModalVisible(false);
  };

  return (
    <PrinterContext.Provider
      value={{
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
      }}
    >
      {children}
    </PrinterContext.Provider>
  );
};

export const usePrinter = () => {
  const context = useContext(PrinterContext);

  if (!context) {
    return {
      selectedPrinter: null,
      setSelectedPrinter: () => {},
      discoveredDevices: [],
      isScanning: false,
      deviceModalVisible: false,
      setDeviceModalVisible: () => {},
      startDeviceDiscovery: async () => {},
      selectPrinter: () => {},
      clearSelectedPrinter: () => {},
      closeDeviceModal: () => {},
    };
  }

  return context;
};
