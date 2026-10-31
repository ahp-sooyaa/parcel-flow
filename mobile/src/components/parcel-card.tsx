import type { MobileRiderParcelListItemDto } from "@parcel-flow/contract";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/button";
import { StatusBadge } from "@/components/status-badge";
import { formatMmk } from "@/format";
import { colors, radii, spacing, typography } from "@/theme/tokens";

type ParcelCardProps = {
  parcel: MobileRiderParcelListItemDto;
  onPress: () => void;
  /** A checkbox for picking the parcel for a batch start delivery. */
  selection?: { checked: boolean; disabled: boolean; onToggle: () => void };
  /** A "Start delivery" button for this parcel alone. */
  startDelivery?: { starting: boolean; disabled: boolean; onPress: () => void };
  /** A "Mark delivered" button that opens the Mark delivered screen. */
  onMarkDelivered?: () => void;
};

export function ParcelCard({
  parcel,
  onPress,
  selection,
  startDelivery,
  onMarkDelivered,
}: Readonly<ParcelCardProps>) {
  return (
    <Pressable
      accessibilityHint="Opens the parcel details"
      accessibilityLabel={`Parcel ${parcel.parcelCode} for ${parcel.receiverName}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <View style={styles.headerStart}>
          {selection ? (
            <Pressable
              accessibilityLabel={`Select ${parcel.parcelCode}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selection.checked, disabled: selection.disabled }}
              disabled={selection.disabled}
              hitSlop={spacing.sm}
              onPress={selection.onToggle}
              style={[
                styles.checkbox,
                selection.checked && styles.checkboxChecked,
                selection.disabled && styles.checkboxDisabled,
              ]}
            >
              {selection.checked ? <Text style={styles.checkmark}>✓</Text> : null}
            </Pressable>
          ) : null}
          <Text style={styles.code}>{parcel.parcelCode}</Text>
        </View>
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

      {startDelivery ? (
        <View style={styles.actions}>
          <Button
            busy={startDelivery.starting}
            disabled={startDelivery.disabled}
            label="Start delivery"
            onPress={startDelivery.onPress}
          />
        </View>
      ) : null}

      {onMarkDelivered ? (
        <View style={styles.actions}>
          <Button label="Mark delivered" onPress={onMarkDelivered} />
        </View>
      ) : null}
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
  headerStart: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    gap: spacing.sm,
  },
  checkbox: {
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 22,
    borderColor: colors.inkMute,
    borderRadius: radii.sm,
    borderWidth: 1.5,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxDisabled: {
    opacity: 0.5,
  },
  checkmark: {
    ...typography.caption,
    color: colors.onPrimary,
    fontWeight: "700",
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
  actions: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
});
