import apiClient from "../services/apiClient.js";
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiServices } from "../services/apiServices.js";

/**
 * Recovers the local counter state securely by checking the remote production database
 */
export const syncCounterFromDatabase = async () => {
  try {
    const serverData = await apiServices.latestReceiptNumber();
    const latestR_Num = serverData.data || 1000;

    await AsyncStorage.setItem(
      "@mandar_global_receipt_counter",
      latestR_Num.toString(),
    );
    return latestR_Num;
  } catch (error) {
    console.warn(
      "⚠️ Network offline. Relying on current local counter snapshot registry.",
    );
    return null;
  }
};

/**
 * Generates a short business sequence ticket code alongside a structural UUID key
 */
export const generateTicketIdentities = async () => {
  const systemUuid = Crypto.randomUUID();

  let currentCounter = await AsyncStorage.getItem(
    "@mandar_global_receipt_counter",
  );

  if (!currentCounter) {
    const recoveredServerIndex = await syncCounterFromDatabase();
    currentCounter = recoveredServerIndex
      ? recoveredServerIndex.toString()
      : "1000";
  }

  const nextCount = parseInt(currentCounter, 10) + 1;
  await AsyncStorage.setItem(
    "@mandar_global_receipt_counter",
    nextCount.toString(),
  );

  return {
    id: systemUuid,
    receiptNumber: nextCount,
  };
};
