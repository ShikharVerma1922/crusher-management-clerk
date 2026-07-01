// app/_layout.js
import React from "react";
import { Tabs } from "expo-router";
import { Text, View, StyleSheet } from "react-native";
import { AuthProvider } from "../src/context/AuthContext";
import { LedgerProvider, useLedger } from "../src/context/LedgerContext";
import { NotebookText, TicketPlus } from "lucide-react-native";

// 📡 Unified Global Header Bar Component
function GlobalHeaderTitleView({ screenTitle }) {
  const { isOnline } = useLedger();

  return (
    <View style={styles.headerContainer}>
      <Text style={styles.headerMainTitle}>{screenTitle}</Text>

      {/* Dynamic Network Status Indicator Dot & Label */}
      <View
        style={[
          styles.networkStatusPill,
          isOnline ? styles.onlineBg : styles.offlineBg,
        ]}
      >
        <View
          style={[
            styles.statusDot,
            isOnline ? styles.onlineDot : styles.offlineDot,
          ]}
        />
        <Text style={styles.networkStatusText}>
          {isOnline ? "ONLINE" : "OFFLINE"}
        </Text>
      </View>
    </View>
  );
}

// Internal Navigation Switcher Configuration
function TabsNavigationDeck() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopWidth: 1,
          borderTopColor: "#e2e8f0",
          height: 60,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarActiveTintColor: "#0f172a", // Solid charcoal slate active color
        tabBarInactiveTintColor: "#94a3b8", // Muted text for non-focus items
        headerStyle: {
          backgroundColor: "#0f172a", // Solid corporate charcoal navigation head bar
          // height: Platform.OS === "ios" ? 100 : 70,
        },
        headerTitleAlign: "left",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerTitle: () => (
            <GlobalHeaderTitleView screenTitle="WEIGHBRIDGE TERMINAL" />
          ),
          tabBarLabel: "New Ticket",
          tabBarIcon: ({ color }) => <TicketPlus color={color} />,
        }}
      />
      <Tabs.Screen
        name="ledger"
        options={{
          headerTitle: () => (
            <GlobalHeaderTitleView screenTitle="SHIFT LOGS LEDGER" />
          ),
          tabBarLabel: "Logs Ledger",
          tabBarIcon: ({ color }) => <NotebookText color={color} />,
        }}
      />
      <Tabs.Screen
        name="login"
        options={{
          href: null,
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      />
    </Tabs>
  );
}

// Master Layout Entry Route Gateway
export default function RootLayout() {
  return (
    <AuthProvider>
      <LedgerProvider>
        <TabsNavigationDeck />
      </LedgerProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingRight: 16,
  },
  headerMainTitle: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  networkStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  onlineBg: { backgroundColor: "#064e3b", borderColor: "#059669" },
  offlineBg: { backgroundColor: "#7f1d1d", borderColor: "#dc2626" },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  onlineDot: { backgroundColor: "#10b981" },
  offlineDot: { backgroundColor: "#f87171" },
  networkStatusText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
