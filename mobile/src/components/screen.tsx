import type { ReactNode } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useKeyboardHeight } from "@/components/use-keyboard-height";
import { colors, spacing } from "@/theme/tokens";

export function Screen({ children }: { children: ReactNode }) {
  const keyboardHeight = useKeyboardHeight();

  return (
    // The keyboard covers the bottom safe area too, so while it's open the
    // screen ends at the keyboard instead. The ScrollView then shrinks and
    // Android keeps the focused field in view.
    <SafeAreaView
      edges={keyboardHeight > 0 ? ["top", "left", "right"] : undefined}
      style={[styles.safeArea, { paddingBottom: keyboardHeight }]}
      testID="screen"
    >
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvasSoft,
  },
  content: {
    flexGrow: 1,
    gap: spacing.lg,
    padding: spacing.xl,
  },
});
