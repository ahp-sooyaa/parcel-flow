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

void mock.module("@/features/merchants/components/merchant-overview-summary-cards", () => ({
  MerchantOverviewSummaryCards: () => <div>merchant summary</div>,
}));

describe("RealtimeMerchantOverviewSummaryCards", async () => {
  const { RealtimeMerchantOverviewSummaryCards } = await import(
    "@/features/merchants/components/realtime-merchant-overview-summary-cards"
  );

  beforeEach(() => {
    refreshMock.mockReset();
    MockEventSource.instances = [];
    Object.defineProperty(globalThis, "EventSource", {
      configurable: true,
      value: MockEventSource,
      writable: true,
    });
  });

  test("refreshes merchant summary cards after realtime invalidation", async () => {
    render(
      <RealtimeMerchantOverviewSummaryCards
        summary={{
          totalCodCollected: 0,
          paidToYou: 0,
          totalParcels: 0,
          onTheWayParcels: 0,
          deliveredParcels: 0,
        }}
      />,
    );

    const eventSource = MockEventSource.instances[0];

    eventSource.emit("stats-invalidated", {
      type: "stats-invalidated",
      parcelId: "parcel-1",
    });

    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
