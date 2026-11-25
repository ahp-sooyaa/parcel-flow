import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * The on-screen keyboard's height while it's open, else 0. Android only: since
 * SDK 54 Android apps draw edge to edge, so the window no longer shrinks for the
 * keyboard and screens have to make room themselves. iOS screens use the
 * ScrollView's `automaticallyAdjustKeyboardInsets` instead, so this stays 0 there.
 */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return undefined;
    }

    const show = Keyboard.addListener("keyboardDidShow", (event) =>
      setHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () => setHeight(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
