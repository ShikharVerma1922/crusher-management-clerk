// app/login.js
import React, { useCallback, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useAuth } from "../src/context/AuthContext";
import { useFocusEffect } from "expo-router";

export default function LoginScreen() {
  const { login } = useAuth();
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState(""); // New input tracking slot
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // 🧹 AUTOMATED SCREEN CLEAR: Flushes the inputs the exact millisecond the page loads
  useFocusEffect(
    useCallback(() => {
      setUsernameInput("");
      setPasswordInput("");
      setIsLoggingIn(false);
    }, []),
  );

  const handlePressLogin = async () => {
    if (!usernameInput.trim() || !passwordInput.trim()) {
      Alert.alert(
        "Input Error ⚠️",
        "Please fill in both operator identity and security password fields.",
      );
      return;
    }

    setIsLoggingIn(true);
    try {
      // Stream parameters directly into the context pipeline loop
      await login(usernameInput, passwordInput);
    } catch (error) {
      // Catch real backend rejections and display them cleanly in a standard popup panel
      Alert.alert("Authentication Failed ❌", error.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mandar Crusher Terminal</Text>
      <Text style={styles.subtitle}>Enter Operator Credentials</Text>

      <TextInput
        style={styles.inputField}
        placeholder="Username"
        placeholderTextColor="#64748b"
        value={usernameInput}
        onChangeText={setUsernameInput}
        autoCapitalize="none"
        editable={!isLoggingIn}
      />

      <TextInput
        style={styles.inputField}
        placeholder="Password"
        placeholderTextColor="#64748b"
        secureTextEntry={true} // Obscures character entries on screen track
        value={passwordInput}
        onChangeText={setPasswordInput}
        autoCapitalize="none"
        editable={!isLoggingIn}
      />

      <TouchableOpacity
        style={[styles.loginBtn, isLoggingIn && styles.disabledBtn]}
        onPress={handlePressLogin}
        disabled={isLoggingIn}
      >
        {isLoggingIn ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.btnText}>Login</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: { fontSize: 22, fontWeight: "900", color: "#f8fafc", marginBottom: 6 },
  subtitle: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 20,
  },
  inputField: {
    backgroundColor: "#1e293b",
    width: "100%",
    maxWidth: 280,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#f8fafc",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 16,
  },
  loginBtn: {
    backgroundColor: "#2563eb",
    width: "100%",
    maxWidth: 280,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  disabledBtn: { backgroundColor: "#475569" },
  btnText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
});
