import type { MobileRiderParcelListItemDto } from "@parcel-flow/contract";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { StatusBadge } from "@/components/status-badge";
import { formatMmk } from "@/format";
import { colors, radii, spacing, typography } from "@/theme/tokens";

type ParcelCardProps = {
  parcel: MobileRiderParcelListItemDto;
  onPress: () => void;
};

export function ParcelCard({ parcel, onPress }: ParcelCardProps) {
  return (
    <Pressable
      accessibilityHint="Opens the parcel details"
      accessibilityLabel={`Parcel ${parcel.parcelCode} for ${parcel.receiverName}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <Text style={styles.code}>{parcel.parcelCode}</Text>
        <StatusBadge label={parcel.statusLabel} status={parcel.status} />
      </View>

      <View style={styles.body}>
        <Text style={styles.receiver}>{parcel.receiverName}</Text>
        <Text style={styles.township}>{parcel.townshipName}</Text>
        <Text style={styles.detail}>{parcel.receiverPhoneNumber}</Text>
        <Text numberOfLines={2} style={styles.detail}>
          {parcel.receiverAddress}
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.amountLabel}>Amount to collect</Text>
        <Text style={styles.amount}>{formatMmk(parcel.amountToCollect)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.canvas,
    borderColor: colors.hairline,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.85,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderBottomColor: colors.hairline,
    borderBottomWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  code: {
    ...typography.caption,
    color: colors.ink,
    fontFamily: "monospace",
  },
  body: {
    gap: spacing.xxs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  receiver: {
    ...typography.bodyMd,
    color: colors.ink,
    fontWeight: "600",
  },
  township: {
    ...typography.micro,
    color: colors.inkMute,
    marginBottom: spacing.xs,
  },
  detail: {
    ...typography.caption,
    color: colors.ink,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopColor: colors.hairline,
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  amountLabel: {
    ...typography.micro,
    color: colors.inkMute,
  },
  amount: {
    ...typography.bodyMd,
    color: colors.ink,
    fontWeight: "700",
  },
});
