import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { queryClient } from "@/api/query-client";
import { Screen } from "@/components/screen";
import { apiUrl } from "@/config";
import { colors, typography } from "@/theme/tokens";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {apiUrl ? (
        <QueryClientProvider client={queryClient}>
          <Stack screenOptions={{ headerShown: false }} />
        </QueryClientProvider>
      ) : (
        <ConfigErrorScreen />
      )}
    </SafeAreaProvider>
  );
}

function ConfigErrorScreen() {
  return (
    <Screen>
      <Text style={styles.title}>App not configured</Text>
      <Text style={styles.body}>
        Set EXPO_PUBLIC_API_URL to the Parcel Flow web address (see mobile/.env.example), then
        restart the app.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.headingLg,
    color: colors.ink,
  },
  body: {
    ...typography.bodyMd,
    color: colors.inkMute,
  },
});
