import { Redirect, Stack } from "expo-router";

import { authClient } from "@/auth/client";
import { LoadingScreen } from "@/components/loading-screen";
import { colors } from "@/theme/tokens";

// Rider screens only render for a stored session. While the session loads from
// secure storage, show a loading state rather than flashing the sign-in screen.
export default function RiderLayout() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.canvas },
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.ink },
        contentStyle: { backgroundColor: colors.canvasSoft },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Parcels" }} />
      <Stack.Screen name="parcels/[parcelId]" options={{ title: "Parcel" }} />
      <Stack.Screen name="profile" options={{ title: "Profile" }} />
    </Stack>
  );
}
