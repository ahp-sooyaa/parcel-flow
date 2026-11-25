import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { colors, radii, spacing, typography } from "@/theme/tokens";

type ButtonProps = {
  label: string;
  onPress: () => void;
  /** `danger` looks like `secondary` with a red label, for destructive actions. */
  variant?: "primary" | "secondary" | "danger";
  busy?: boolean;
  disabled?: boolean;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  busy = false,
  disabled = false,
}: ButtonProps) {
  const isPrimary = variant === "primary";
  const isDisabled = disabled || busy;
  const labelStyle = {
    primary: styles.primaryLabel,
    secondary: styles.secondaryLabel,
    danger: styles.dangerLabel,
  }[variant];

  return (
    <Pressable
      // Keeps the button's name while the spinner replaces its text.
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        pressed && isPrimary && styles.primaryPressed,
        isDisabled && styles.disabled,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={labelStyle.color} />
      ) : (
        <Text style={[styles.label, labelStyle]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    paddingHorizontal: 20,
    paddingVertical: spacing.md,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  primaryPressed: {
    backgroundColor: colors.primaryDeep,
  },
  secondary: {
    backgroundColor: colors.canvas,
    borderColor: colors.hairline,
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.6,
  },
  label: typography.buttonMd,
  primaryLabel: {
    color: colors.onPrimary,
  },
  secondaryLabel: {
    color: colors.ink,
  },
  dangerLabel: {
    color: colors.danger,
  },
});
