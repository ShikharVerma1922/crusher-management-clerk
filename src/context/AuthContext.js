// src/context/AuthContext.js
import React, { createContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useSegments } from "expo-router";
import apiClient from "../services/apiClient";
import { apiServices } from "../services/apiServices";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [clerk, setClerk] = useState(null);
  const [shiftId, setShiftId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;
    const onLoginScreen = segments[0] === "login";

    if (!clerk && !onLoginScreen) {
      router.replace("/login");
    } else if (clerk && onLoginScreen) {
      router.replace("/");
    }
  }, [clerk, segments, isLoading]);

  useEffect(() => {
    const loadSavedSession = async () => {
      try {
        const savedClerk = await AsyncStorage.getItem("@mandar_clerk_session");
        const savedShift = await AsyncStorage.getItem(
          "@mandar_active_shift_id",
        );
        if (savedClerk && savedShift) {
          setClerk(JSON.parse(savedClerk));
          setShiftId(savedShift);
        }
      } catch (e) {
        console.error("Storage load error:", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadSavedSession();
  }, []);

  // 📡 CONNECTED REAL BACKEND LOGIN ROUTINE
  const login = async (username, password) => {
    try {
      console.log(`Attempting secure gateway dispatch for: ${username}`);

      const { data, status } = await apiServices.login(username, password);

      const identityProfile = data?.user;
      const sessionId = data?.shiftId;

      // 🛡️ Safety fallback check to guarantee non-null entities go to AsyncStorage
      if (!identityProfile || !sessionId) {
        throw new Error(
          "Missing unexpected data parameters in backend schema map.",
        );
      }

      // Save down into the local app storage container securely
      await AsyncStorage.setItem(
        "@mandar_clerk_session",
        JSON.stringify(identityProfile),
      );
      await AsyncStorage.setItem("@mandar_active_shift_id", String(sessionId));

      // React Context state updates
      setClerk(identityProfile);
      setShiftId(String(sessionId));

      return { success: true };
    } catch (error) {
      console.error("❌ Authentication gateway rejection:", error.message);

      let clientErrorMessage = "Backend server is completely unreachable.";
      if (error.response) {
        clientErrorMessage =
          error.response.data?.message || "Invalid credentials. Access Denied.";
      }

      throw new Error(clientErrorMessage);
    }
  };

  const logout = async () => {
    try {
      await apiServices.logout;

      await AsyncStorage.removeItem("@mandar_clerk_session");
      await AsyncStorage.removeItem("@mandar_active_shift_id");
      await AsyncStorage.removeItem("@mandar_sync_ops_queue");

      setClerk(null);
      setShiftId(null);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <AuthContext.Provider value={{ clerk, shiftId, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    return {
      clerk: null,
      shiftId: null,
      isLoading: true,
      login: async () => {},
      logout: async () => {},
    };
  }
  return context;
};
