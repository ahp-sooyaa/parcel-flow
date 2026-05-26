import { beforeEach, describe, expect, mock, test } from "bun:test";
import { act, render, screen, waitFor } from "@testing-library/react";

import { buildParcelListItem } from "../fixtures/builders";

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

void mock.module("@/features/parcels/components/rider-parcel-card-list", () => ({
  RiderParcelCardList: ({ parcels }: { parcels: Array<{ parcelCode: string }> }) => (
    <div>{parcels.map((parcel) => parcel.parcelCode).join(",")}</div>
  ),
}));

describe("RealtimeRiderParcelCardList", async () => {
  const { RealtimeRiderParcelCardList } = await import(
    "@/features/parcels/components/realtime-rider-parcel-card-list"
  );

  beforeEach(() => {
    MockEventSource.instances = [];
    Object.defineProperty(globalThis, "EventSource", {
      configurable: true,
      value: MockEventSource,
      writable: true,
    });
  });

  test("updates rider-visible parcels from realtime payloads", async () => {
    render(
      <RealtimeRiderParcelCardList
        parcels={[buildParcelListItem({ id: "parcel-1", parcelCode: "PF-001" })]}
      />,
    );

    const eventSource = MockEventSource.instances[0];

    act(() => {
      eventSource.emit("parcel-upsert", {
        type: "parcel-upsert",
        parcel: buildParcelListItem({ id: "parcel-1", parcelCode: "PF-001-UPDATED" }),
      });
    });

    await waitFor(() => {
      expect(screen.getByText("PF-001-UPDATED")).toBeTruthy();
    });
  });
});
