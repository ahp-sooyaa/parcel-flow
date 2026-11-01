import { renderHook } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";

import { queryClient } from "@/api/query-client";
import { signOutRider } from "@/auth/session";
import {
  createParcelEventsConnection,
  type ParcelEventsHandlers,
} from "@/realtime/parcel-events-connection";
import { useRiderParcelEvents } from "@/realtime/use-rider-parcel-events";

jest.mock("@/auth/session", () => ({ signOutRider: jest.fn() }));
jest.mock("@/realtime/parcel-events-connection", () => ({
  createParcelEventsConnection: jest.fn(),
}));

const connection = { start: jest.fn(), stop: jest.fn() };
let handlers: ParcelEventsHandlers;
let onAppStateChange: (status: AppStateStatus) => void;
const removeListener = jest.fn();
const originalCurrentState = Object.getOwnPropertyDescriptor(AppState, "currentState");

// Jest's React Native mock makes `currentState` a function, so set a plain value.
function setCurrentState(status: AppStateStatus) {
  Object.defineProperty(AppState, "currentState", { value: status, configurable: true });
}

beforeEach(() => {
  connection.start.mockReset();
  connection.stop.mockReset();
  jest.mocked(createParcelEventsConnection).mockImplementation((given) => {
    handlers = given;
    return connection;
  });
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    onAppStateChange = listener;
    return { remove: removeListener };
  });
  setCurrentState("active");
});

afterEach(() => {
  jest.restoreAllMocks();

  if (originalCurrentState) {
    Object.defineProperty(AppState, "currentState", originalCurrentState);
  }
});

describe("useRiderParcelEvents", () => {
  it("streams while active, closes in the background, and reopens", async () => {
    const { unmount } = await renderHook(() => useRiderParcelEvents());
    expect(connection.start).toHaveBeenCalledTimes(1);

    onAppStateChange("inactive");
    expect(connection.stop).not.toHaveBeenCalled();

    onAppStateChange("background");
    expect(connection.stop).toHaveBeenCalledTimes(1);

    onAppStateChange("active");
    expect(connection.start).toHaveBeenCalledTimes(2);

    await unmount();
    expect(removeListener).toHaveBeenCalled();
    expect(connection.stop).toHaveBeenCalledTimes(2);
  });

  it("doesn't open the stream when mounted in the background", async () => {
    setCurrentState("background");

    await renderHook(() => useRiderParcelEvents());

    expect(connection.start).not.toHaveBeenCalled();
  });

  it("refetches the lists and each changed parcel, and signs out on 401", async () => {
    const invalidate = jest.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
    await renderHook(() => useRiderParcelEvents());

    handlers.onChanged(["p1", "p2"]);
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      ["rider-parcels"],
      ["rider-parcel", "p1"],
      ["rider-parcel", "p2"],
    ]);

    invalidate.mockClear();
    handlers.onReconnected();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["rider-parcels"] });

    handlers.onUnauthorized();
    expect(signOutRider).toHaveBeenCalled();
  });
});
