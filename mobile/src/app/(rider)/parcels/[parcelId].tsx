import { router, useLocalSearchParams } from "expo-router";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { MobileApiError } from "@/api/client";
import { useRiderParcel } from "@/api/parcels";
import { Button } from "@/components/button";
import { LoadingScreen } from "@/components/loading-screen";
import { Notice } from "@/components/notice";
import { Screen } from "@/components/screen";
import { StatusBadge } from "@/components/status-badge";
import { formatMmk } from "@/format";
import { colors, radii, spacing, typography } from "@/theme/tokens";

const parcelTypeLabels = { cod: "Cash on delivery", non_cod: "Prepaid" } as const;

export default function ParcelDetailScreen() {
  const { parcelId } = useLocalSearchParams<{ parcelId: string }>();
  const parcel = useRiderParcel(parcelId);
  const detail = parcel.data;
  // The list row shows right away; the full detail fills in when it arrives.
  const summary = detail ?? parcel.preview;

  if (parcel.isError && parcel.error instanceof MobileApiError && parcel.error.status === 404) {
    return (
      <Screen>
        <Notice message="This parcel is no longer assigned to you." tone="warning" />
        <Button label="Back to parcels" onPress={() => router.back()} variant="secondary" />
      </Screen>
    );
  }

  if (!summary) {
    if (parcel.isError) {
      return (
        <Screen>
          <Notice message={parcel.error.message} />
          <Button label="Try again" onPress={() => void parcel.refetch()} variant="secondary" />
        </Screen>
      );
    }

    return <LoadingScreen />;
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.code}>{summary.parcelCode}</Text>
        <StatusBadge label={summary.statusLabel} status={summary.status} />
      </View>

      {detail?.activeFailureNote ? (
        <Notice message={`Failure note: ${detail.activeFailureNote}`} tone="warning" />
      ) : null}

      <Section title="Receiver">
        <Text style={styles.primaryText}>{summary.receiverName}</Text>
        <Pressable
          accessibilityHint="Opens the phone dialer"
          accessibilityLabel={`Call ${summary.receiverPhoneNumber}`}
          accessibilityRole="link"
          onPress={() => void Linking.openURL(`tel:${summary.receiverPhoneNumber}`)}
        >
          <Text style={styles.phone}>{summary.receiverPhoneNumber}</Text>
        </Pressable>
        <Text style={styles.bodyText}>{summary.receiverAddress}</Text>
        <Text style={styles.mutedText}>{summary.townshipName}</Text>
      </Section>

      <Section title="Collection">
        <Row label="Amount to collect" value={formatMmk(summary.amountToCollect)} strong />
        {detail ? (
          <>
            <Row label="COD amount" value={formatMmk(detail.codAmount)} />
            <Row label="Delivery fee" value={formatMmk(detail.deliveryFee)} />
          </>
        ) : null}
      </Section>

      {detail ? (
        <Section title="Parcel">
          <Row label="Merchant" value={detail.merchantName} />
          <Row label="Type" value={parcelTypeLabels[detail.parcelType]} />
          <Row label="Weight" value={`${detail.weightKg} kg`} />
          {detail.specialNotes ? (
            <View style={styles.notes}>
              <Text style={styles.rowLabel}>Special notes</Text>
              <Text style={styles.bodyText}>{detail.specialNotes}</Text>
            </View>
          ) : null}
        </Section>
      ) : (
        <Text style={styles.mutedText}>Loading parcel details…</Text>
      )}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowValueStrong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  code: {
    ...typography.bodyMd,
    color: colors.ink,
    fontFamily: "monospace",
  },
  section: {
    gap: spacing.xs,
    backgroundColor: colors.canvas,
    borderColor: colors.hairline,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  sectionTitle: {
    ...typography.micro,
    color: colors.inkMute,
    letterSpacing: 1,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
  },
  primaryText: {
    ...typography.headingLg,
    color: colors.ink,
  },
  phone: {
    ...typography.bodyMd,
    color: colors.primary,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  bodyText: {
    ...typography.bodyMd,
    color: colors.ink,
  },
  mutedText: {
    ...typography.caption,
    color: colors.inkMute,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  rowLabel: {
    ...typography.caption,
    color: colors.inkMute,
  },
  rowValue: {
    ...typography.bodyMd,
    color: colors.ink,
    flexShrink: 1,
    textAlign: "right",
  },
  rowValueStrong: {
    fontWeight: "700",
  },
  notes: {
    gap: spacing.xxs,
    paddingTop: spacing.xs,
  },
});
