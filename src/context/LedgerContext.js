// src/context/LedgerContext.js
import React, { createContext, useState, useEffect, useContext } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";
import { AuthContext } from "./AuthContext";
import apiClient from "../services/apiClient.js";
import { generateTicketIdentities } from "../utils/idGenerator.js";
import { apiServices } from "../services/apiServices.js";

export const LedgerContext = createContext(null);

export const LedgerProvider = ({ children }) => {
  const [transactions, setTransactions] = useState([]);
  const { shiftId } = useContext(AuthContext);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const initializeLedger = async () => {
      if (shiftId) {
        await cleanupLedger();
        await loadCachedTickets();
      }
    };

    initializeLedger();
  }, [shiftId]);

  // Heartbeat polling monitor loop (Every 4 seconds)
  useEffect(() => {
    let networkSubscription;
    const verifyServerHealthChannel = async () => {
      try {
        const status = await Network.getNetworkStateAsync();
        if (!(status.isConnected && status.isInternetReachable)) return false;
        return await apiServices.isOnline();
      } catch (err) {
        return false;
      }
    };

    const startMonitoring = async () => {
      const initialHealthState = await verifyServerHealthChannel();
      setIsOnline(initialHealthState);
      if (initialHealthState && shiftId) flushOperationQueue();

      networkSubscription = setInterval(async () => {
        const liveServerHealth = await verifyServerHealthChannel();
        setIsOnline((prevOnlineState) => {
          if (!prevOnlineState && liveServerHealth) {
            console.log(
              "🌐 [Sync Engine] Connection active. Flushing pending operations queue...",
            );
            setTimeout(() => {
              flushOperationQueue();
            }, 500);
          }
          return liveServerHealth;
        });
      }, 4000);
    };

    startMonitoring();
    return () => {
      if (networkSubscription) clearInterval(networkSubscription);
    };
  }, [shiftId]);

  const cleanupLedger = async () => {
    const ledgerData =
      (await AsyncStorage.getItem("@mandar_weighbridge_ledger")) || "[]";

    let allTickets = JSON.parse(ledgerData);

    if (!Array.isArray(allTickets)) {
      allTickets = [];
    }

    const RETENTION_PERIOD = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();

    const retainedTickets = allTickets.filter((ticket) => {
      if (!ticket.synced) return true;

      const createdAtTime = ticket?.createdAt
        ? new Date(ticket.createdAt).getTime()
        : now;

      return now - createdAtTime < RETENTION_PERIOD;
    });

    await AsyncStorage.setItem(
      "@mandar_weighbridge_ledger",
      JSON.stringify(retainedTickets),
    );

    setTransactions(retainedTickets.filter((t) => t.shiftId === shiftId));
  };

  // Load UI state array from local cache disk
  const loadCachedTickets = async () => {
    try {
      const existingData = await AsyncStorage.getItem(
        "@mandar_weighbridge_ledger",
      );
      if (existingData) {
        const allTickets = JSON.parse(existingData);
        setTransactions(allTickets.filter((t) => t.shiftId === shiftId));
      } else {
        setTransactions([]);
      }
    } catch (e) {
      console.error("❌ Ledger load fault:", e.message);
    }
  };

  // 1️⃣ APPEND NEW TRANSACTION OP TO QUEUE
  const appendNewTicket = async (newTicket) => {
    try {
      const ticketSchema = {
        ...newTicket,
        dbId: null,
      };

      const existingData =
        (await AsyncStorage.getItem("@mandar_weighbridge_ledger")) || "[]";
      const allTickets = JSON.parse(existingData);
      const updatedTickets = [ticketSchema, ...allTickets];
      await AsyncStorage.setItem(
        "@mandar_weighbridge_ledger",
        JSON.stringify(updatedTickets),
      );
      setTransactions(updatedTickets.filter((t) => t.shiftId === shiftId));

      // 📥 Push a CREATE command operation directly into the FIFO pipeline queue array
      const queueData =
        (await AsyncStorage.getItem("@mandar_sync_ops_queue")) || "[]";
      const currentQueue = JSON.parse(queueData);

      currentQueue.push({
        type: "CREATE",
        localId: newTicket.id,
        payload: {
          ...newTicket,
        },
      });
      await AsyncStorage.setItem(
        "@mandar_sync_ops_queue",
        JSON.stringify(currentQueue),
      );

      if (isOnline)
        setTimeout(() => {
          flushOperationQueue();
        }, 300);
    } catch (e) {
      console.error("❌ Append fault:", e.message);
      throw e;
    }
  };

  // 2️⃣ APPEND VOID REQUEST OP TO QUEUE
  const voidTransactionTicket = async (ticketId, reason) => {
    try {
      // Instantly apply the structural update into our visual UI cache state thread
      const existingData = await AsyncStorage.getItem(
        "@mandar_weighbridge_ledger",
      );
      if (!existingData) return;
      const allTickets = JSON.parse(existingData);
      const idx = allTickets.findIndex((t) => t.id === ticketId);
      console.log(allTickets);
      console.log(idx);
      console.log(ticketId);
      console.log("test1");
      if (idx !== -1) {
        console.log("test2");
        allTickets[idx].isVoid = true;
        allTickets[idx].voidReason = reason;
        await AsyncStorage.setItem(
          "@mandar_weighbridge_ledger",
          JSON.stringify(allTickets),
        );
        setTransactions(allTickets.filter((t) => t.shiftId === shiftId));
      }

      // 📥 Push a VOID command operation directly onto the back tail of our queue array
      const queueData =
        (await AsyncStorage.getItem("@mandar_sync_ops_queue")) || "[]";
      const currentQueue = JSON.parse(queueData);

      currentQueue.push({
        type: "VOID",
        localId: ticketId,
        reason: reason,
      });
      await AsyncStorage.setItem(
        "@mandar_sync_ops_queue",
        JSON.stringify(currentQueue),
      );

      if (isOnline) flushOperationQueue();
    } catch (e) {
      console.error("❌ Void setup fault:", e.message);
      throw e;
    }
  };

  // 🚀 3️⃣ STRICT FIRST-IN, FIRST-OUT PROCESSING WORKER ENGINE
  const flushOperationQueue = async () => {
    try {
      // await AsyncStorage.clear();
      const queueData = await AsyncStorage.getItem("@mandar_sync_ops_queue");
      if (!queueData) return;

      let currentQueue = JSON.parse(queueData);
      if (currentQueue.length === 0) return;

      console.log(
        `📡 [Queue Engine] Processing ${currentQueue.length} ordered workflow operations...`,
      );

      // Read our standard ledger history state context to record database mappings
      const ledgerData =
        (await AsyncStorage.getItem("@mandar_weighbridge_ledger")) || "[]";
      let allTickets = JSON.parse(ledgerData);

      // Loop through queue arrays maintaining exact time priority order
      while (currentQueue.length > 0) {
        const currentOp = currentQueue[0]; // Peek at the head item of the queue array

        try {
          if (currentOp.type === "CREATE") {
            console.log(
              `🚛 Processing ordered CREATE payload for local ID: [${currentOp.localId}]`,
            );

            // const response = await apiClient.post(
            //   "/transactions",
            //   currentOp.payload,
            // );
            const serverData = await apiServices.postTransaction(
              currentOp.payload,
            );

            if (serverData.status === 201 || serverData.status === 200) {
              const serverEntity = serverData.data?.data;
              const trueDatabaseId = serverEntity?.id || serverEntity?._id;

              if (trueDatabaseId) {
                // Pin the true database ID to our local transactional matrix matching this exact reference key
                const tIdx = allTickets.findIndex(
                  (t) => t.id === currentOp.localId,
                );
                if (tIdx !== -1) {
                  allTickets[tIdx].dbId = trueDatabaseId;
                  allTickets[tIdx].synced = true;
                }
                console.log(
                  `🔗 Mapped Local ${currentOp.localId} ──► Database ID [${trueDatabaseId}]`,
                );
              }
            }
          } else if (currentOp.type === "VOID") {
            // Find what the database key evaluates to at this exact millisecond point in time!
            const targetTicket = allTickets.find(
              (t) => t.id === currentOp.localId,
            );
            const resolvedDatabaseKey = targetTicket?.dbId || currentOp.localId;

            console.log(
              `🛑 Processing ordered VOID payload for target DB Key: [${resolvedDatabaseKey}]`,
            );
            const serverData = await apiServices.postVoidRequest(
              resolvedDatabaseKey,
              currentOp.reason,
            );

            if (serverData.status === 201 || serverData.status === 200) {
              const tIdx = allTickets.findIndex(
                (t) => t.id === currentOp.localId,
              );
              if (tIdx !== -1) allTickets[tIdx].synced = true;
            }
          }

          // Operation completed successfully! Dequeue the item from the front of the queue.
          currentQueue.shift();

          // Save progress incrementally to protect states
          await AsyncStorage.setItem(
            "@mandar_sync_ops_queue",
            JSON.stringify(currentQueue),
          );

          await AsyncStorage.setItem(
            "@mandar_weighbridge_ledger",
            JSON.stringify(allTickets),
          );
        } catch (apiError) {
          if (apiError.response) {
            console.error(
              `❌ [Queue Halted - Server Error ${apiError.response.status}]:`,
              apiError.response.data?.message || apiError.response.data,
            );
          } else {
            console.log(
              `📡 [Queue Blocked] Dynamic network route down: ${apiError.message}`,
            );
          }
          break; // Stop execution loop immediately. Maintain queue state array sequence until pipeline clears.
        }
      }

      console.log("Running ledger cleanup...");
      // console.log(allTickets);

      await cleanupLedger();
    } catch (error) {
      console.error("❌ Master queue worker failure:", error.message);
    }
  };

  return (
    <LedgerContext.Provider
      value={{
        transactions,
        appendNewTicket,
        voidTransactionTicket,
        flushOperationQueue,
        isOnline,
      }}
    >
      {children}
    </LedgerContext.Provider>
  );
};

export const useLedger = () => {
  const context = useContext(LedgerContext);
  if (!context)
    return {
      transactions: [],
      appendNewTicket: async () => {},
      voidTransactionTicket: async () => {},
      flushOperationQueue: async () => {},
      isOnline: true,
    };
  return context;
};
