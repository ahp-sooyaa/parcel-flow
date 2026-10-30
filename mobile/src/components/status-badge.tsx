import type { MobileParcelStatus } from "@parcel-flow/contract";
import { StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, typography } from "@/theme/tokens";

// Quiet tones in the same spirit as the web StatusBadge: finished work reads
// calm, work in progress reads active, problems read warm.
const toneByStatus: Record<MobileParcelStatus, { background: string; text: string }> = {
  at_office: { background: colors.canvasSoft, text: colors.inkMute },
  on_the_way: { background: colors.progressSoft, text: colors.primary },
  delivered: { background: colors.successSoft, text: colors.successInk },
  postpone: { background: colors.warningSoft, text: colors.warningInk },
  canceled_returned: { background: colors.dangerSoft, text: colors.danger },
  returned_to_merchant: { background: colors.canvasSoft, text: colors.inkMute },
};

export function StatusBadge({ label, status }: { label: string; status: MobileParcelStatus }) {
  const tone = toneByStatus[status];

  return (
    <View style={[styles.badge, { backgroundColor: tone.background }]}>
      <Text style={[styles.label, { color: tone.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  label: typography.micro,
});
