import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useMe } from "@/api/me";
import { signOutRider } from "@/auth/session";
import { Button } from "@/components/button";
import { LoadingScreen } from "@/components/loading-screen";
import { Notice } from "@/components/notice";
import { Screen } from "@/components/screen";
import { colors, radii, spacing, typography } from "@/theme/tokens";

export default function ProfileScreen() {
  const me = useMe();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOutRider();
  }

  if (me.isPending) {
    return <LoadingScreen />;
  }

  return (
    <Screen>
      {me.isError ? (
        <>
          <Notice message={me.error.message} />
          <Button label="Try again" onPress={() => void me.refetch()} variant="secondary" />
        </>
      ) : (
        <>
          <Text style={styles.name}>{me.data.name}</Text>

          {me.data.mustResetPassword ? (
            <Notice
              message="An admin reset your password. Change it from the web dashboard settings."
              tone="warning"
            />
          ) : null}

          <View style={styles.card}>
            <ProfileRow label="Username" value={me.data.username} />
            <ProfileRow label="Phone" value={me.data.phoneNumber} />
          </View>
        </>
      )}

      <View style={styles.footer}>
        <Button busy={signingOut} label="Sign out" onPress={handleSignOut} variant="secondary" />
      </View>
    </Screen>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  name: {
    ...typography.displayMd,
    color: colors.ink,
  },
  card: {
    backgroundColor: colors.canvas,
    borderColor: colors.hairline,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  rowLabel: {
    ...typography.caption,
    color: colors.inkMute,
  },
  rowValue: {
    ...typography.bodyMd,
    color: colors.ink,
  },
  footer: {
    marginTop: "auto",
  },
});
