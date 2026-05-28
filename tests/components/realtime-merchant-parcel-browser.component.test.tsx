import { beforeEach, describe, expect, mock, test } from "bun:test";
import { render } from "@testing-library/react";

const refreshMock = mock(() => undefined);

type MockEventSourceListener = (event: MessageEvent<string>) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];

  listeners = new Map<string, MockEventSourceListener[]>();

  constructor(public readonly url: string) {
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: EventListener) {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener as MockEventSourceListener);
    this.listeners.set(type, existing);
  }

  close() {}

  emit(type: string, payload: unknown) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(new MessageEvent("message", { data: JSON.stringify(payload) }));
    }
  }
}

void mock.module("@/lib/client-navigation", () => ({
  useAppRouter: () => ({
    refresh: refreshMock,
  }),
}));

void mock.module("@/features/parcels/components/merchant-parcel-browser", () => ({
  MerchantParcelBrowser: () => <div>merchant browser</div>,
}));

describe("RealtimeMerchantParcelBrowser", async () => {
  const { RealtimeMerchantParcelBrowser } =
    await import("@/features/parcels/components/realtime-merchant-parcel-browser");

  beforeEach(() => {
    refreshMock.mockReset();
    MockEventSource.instances = [];
    Object.defineProperty(globalThis, "EventSource", {
      configurable: true,
      value: MockEventSource,
      writable: true,
    });
  });

  test("refreshes the server-rendered merchant parcel page when a parcel changes", async () => {
    render(
      <RealtimeMerchantParcelBrowser
        result={{
          parcels: [],
          page: 1,
          pageSize: 10,
          totalCount: 0,
          totalPages: 1,
          hasAnyParcels: false,
        }}
        filters={{ searchTerm: "", createdOn: null, status: "all", page: 1, pageSize: 10 }}
      />,
    );

    const eventSource = MockEventSource.instances[0];

    eventSource.emit("parcel-upsert", {
      type: "parcel-upsert",
      parcel: { id: "parcel-1" },
    });

    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
