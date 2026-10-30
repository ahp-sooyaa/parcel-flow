import { StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, typography } from "@/theme/tokens";

type NoticeProps = {
  message: string;
  tone?: "danger" | "warning";
};

export function Notice({ message, tone = "danger" }: NoticeProps) {
  const isDanger = tone === "danger";

  return (
    <View
      accessibilityRole="alert"
      style={[styles.notice, isDanger ? styles.dangerNotice : styles.warningNotice]}
    >
      <Text style={[styles.message, isDanger ? styles.dangerText : styles.warningText]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    borderRadius: radii.md,
    padding: spacing.md,
  },
  dangerNotice: {
    backgroundColor: colors.dangerSoft,
  },
  warningNotice: {
    backgroundColor: colors.warningSoft,
  },
  message: typography.caption,
  dangerText: {
    color: colors.danger,
  },
  warningText: {
    color: colors.warningInk,
  },
});
