import { focusManager, onlineManager, QueryClient } from "@tanstack/react-query";
import * as Network from "expo-network";
import { AppState, Platform } from "react-native";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A 401 signs the rider out; retrying other errors once covers flaky mobile data.
      retry: (failureCount, error) =>
        failureCount < 1 && !(error instanceof Error && "status" in error && error.status === 401),
    },
  },
});

// React Native has no window focus or online events, so tell TanStack Query when
// the app returns to the foreground or the phone reconnects; active queries then
// refetch. This covers changes made while the app was in the background, when the
// live parcel stream (src/realtime) is closed.
focusManager.setEventListener((setFocused) => {
  if (Platform.OS === "web") {
    return undefined;
  }

  const subscription = AppState.addEventListener("change", (status) => {
    setFocused(status === "active");
  });

  return () => subscription.remove();
});

onlineManager.setEventListener((setOnline) => {
  const subscription = Network.addNetworkStateListener((state) => {
    setOnline(state.isConnected !== false);
  });

  return () => subscription.remove();
});
