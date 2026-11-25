import { StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, typography } from "@/theme/tokens";

type NoticeProps = {
  message: string;
  tone?: "danger" | "warning" | "success";
};

export function Notice({ message, tone = "danger" }: NoticeProps) {
  return (
    <View accessibilityRole="alert" style={[styles.notice, toneStyles[tone].notice]}>
      <Text style={[styles.message, toneStyles[tone].text]}>{message}</Text>
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
  successNotice: {
    backgroundColor: colors.successSoft,
  },
  successText: {
    color: colors.successInk,
  },
});

const toneStyles = {
  danger: { notice: styles.dangerNotice, text: styles.dangerText },
  warning: { notice: styles.warningNotice, text: styles.warningText },
  success: { notice: styles.successNotice, text: styles.successText },
};
