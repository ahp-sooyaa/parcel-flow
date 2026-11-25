import { ActivityIndicator, StyleSheet, View } from "react-native";

import { colors } from "@/theme/tokens";

export function LoadingScreen() {
  return (
    <View accessibilityLabel="Loading" style={styles.container}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvasSoft,
  },
});
