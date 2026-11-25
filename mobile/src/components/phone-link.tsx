import { Linking, Pressable, StyleSheet, Text } from "react-native";

import { colors, typography } from "@/theme/tokens";

/** A phone number that opens the dialer when tapped. */
export function PhoneLink({ phoneNumber }: Readonly<{ phoneNumber: string }>) {
  return (
    <Pressable
      accessibilityHint="Opens the phone dialer"
      accessibilityLabel={`Call ${phoneNumber}`}
      accessibilityRole="link"
      onPress={() => void Linking.openURL(`tel:${phoneNumber}`)}
    >
      <Text style={styles.phone}>{phoneNumber}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  phone: {
    ...typography.bodyMd,
    color: colors.primary,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
