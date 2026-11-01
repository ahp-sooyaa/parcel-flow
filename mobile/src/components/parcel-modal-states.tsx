import type { MobileRiderParcelListItemDto } from "@parcel-flow/contract";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { MobileApiError } from "@/api/client";
import type { useRiderParcel } from "@/api/parcels";
import { Button } from "@/components/button";
import { LoadingScreen } from "@/components/loading-screen";
import { Notice } from "@/components/notice";
import { Screen } from "@/components/screen";
import { colors, spacing, typography } from "@/theme/tokens";

// Pieces shared by the parcel action modals (Mark delivered, Failure note).

/** Why the action can't be taken, with a way back. */
export function NotEligible({
  message,
  options,
}: Readonly<{ message: string; options: ReactNode }>) {
  return (
    <Screen>
      {options}
      <Notice message={message} tone="warning" />
      <Button label="Back" onPress={() => router.back()} variant="secondary" />
    </Screen>
  );
}

/**
 * The screen to show instead of the modal's content while the parcel isn't
 * `ready` (loading or failed), or when it's no longer the rider's. Null once
 * the modal can render.
 */
export function parcelLoadState(
  parcel: ReturnType<typeof useRiderParcel>,
  options: { screenOptions: ReactNode; ready: boolean },
) {
  if (parcel.isError && parcel.error instanceof MobileApiError && parcel.error.status === 404) {
    return (
      <NotEligible
        message="This parcel is no longer assigned to you."
        options={options.screenOptions}
      />
    );
  }

  if (options.ready) {
    return null;
  }

  if (parcel.isError) {
    return (
      <Screen>
        {options.screenOptions}
        <Notice message={parcel.error.message} />
        <Button label="Try again" onPress={() => void parcel.refetch()} variant="secondary" />
      </Screen>
    );
  }

  return <LoadingScreen />;
}

/** Parcel code, receiver and address, with a call link when `callable`. */
export function ParcelSummary({
  parcel,
  callable = false,
}: Readonly<{ parcel: MobileRiderParcelListItemDto; callable?: boolean }>) {
  return (
    <View style={styles.summary}>
      <Text style={styles.code}>{parcel.parcelCode}</Text>
      <Text style={styles.receiver}>{parcel.receiverName}</Text>
      {callable ? (
        <Pressable
          accessibilityHint="Opens the phone dialer"
          accessibilityLabel={`Call ${parcel.receiverPhoneNumber}`}
          accessibilityRole="link"
          onPress={() => void Linking.openURL(`tel:${parcel.receiverPhoneNumber}`)}
        >
          <Text style={styles.phone}>{parcel.receiverPhoneNumber}</Text>
        </Pressable>
      ) : null}
      <Text style={styles.address}>{parcel.receiverAddress}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    gap: spacing.xxs,
  },
  code: {
    ...typography.caption,
    color: colors.inkMute,
    fontFamily: "monospace",
  },
  receiver: {
    ...typography.headingLg,
    color: colors.ink,
  },
  phone: {
    ...typography.bodyMd,
    color: colors.primary,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  address: {
    ...typography.bodyMd,
    color: colors.ink,
  },
});
