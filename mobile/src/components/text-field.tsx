import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { colors, radii, spacing, typography } from "@/theme/tokens";

type TextFieldProps = Omit<TextInputProps, "style"> & {
  label: string;
};

export function TextField({ label, ...inputProps }: TextFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.inkFaint}
        style={styles.input}
        {...inputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.ink,
    fontWeight: "600",
  },
  input: {
    ...typography.bodyMd,
    minHeight: 48,
    backgroundColor: colors.canvas,
    borderColor: colors.hairline,
    borderRadius: radii.sm,
    borderWidth: 1,
    color: colors.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
});
