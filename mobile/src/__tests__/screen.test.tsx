import { act, render, screen } from "@testing-library/react-native";
import { Keyboard, Platform, StyleSheet, Text, type KeyboardEvent } from "react-native";

import { Screen } from "@/components/screen";

type Listener = (event: KeyboardEvent) => void;

function captureKeyboardListeners() {
  const listeners = new Map<string, Listener>();
  jest.spyOn(Keyboard, "addListener").mockImplementation((name, listener) => {
    listeners.set(name, listener as Listener);
    return { remove: jest.fn() } as unknown as ReturnType<typeof Keyboard.addListener>;
  });
  return listeners;
}

async function renderScreen() {
  await render(
    <Screen>
      <Text>Content</Text>
    </Screen>,
  );
  return () => screen.getByTestId("screen");
}

function paddingBottom(element: { props: { style?: unknown } } | null | undefined) {
  return StyleSheet.flatten(element?.props.style as never)?.paddingBottom;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("Screen keyboard handling", () => {
  it("ends the screen at the Android keyboard while it's open", async () => {
    jest.replaceProperty(Platform, "OS", "android");
    const listeners = captureKeyboardListeners();
    const safeArea = await renderScreen();

    expect(paddingBottom(safeArea())).toBe(0);

    await act(async () => {
      listeners.get("keyboardDidShow")?.({ endCoordinates: { height: 300 } } as KeyboardEvent);
    });
    expect(paddingBottom(safeArea())).toBe(300);
    expect(safeArea()?.props.edges).toMatchObject({ bottom: "off" });

    await act(async () => {
      listeners.get("keyboardDidHide")?.({} as KeyboardEvent);
    });
    expect(paddingBottom(safeArea())).toBe(0);
  });

  it("leaves iOS to the ScrollView's keyboard insets", async () => {
    jest.replaceProperty(Platform, "OS", "ios");
    const listeners = captureKeyboardListeners();

    await renderScreen();

    expect(listeners.size).toBe(0);
  });
});
