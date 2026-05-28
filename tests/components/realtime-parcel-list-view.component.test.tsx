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

void mock.module("@/features/parcels/components/parcel-list-view", () => ({
  ParcelListView: ({ parcels }: { parcels: Array<{ parcelCode: string }> }) => (
    <div>{parcels.map((parcel) => parcel.parcelCode).join(",")}</div>
  ),
}));

describe("RealtimeParcelListView", async () => {
  const { RealtimeParcelListView } =
    await import("@/features/parcels/components/realtime-parcel-list-view");

  beforeEach(() => {
    MockEventSource.instances = [];
    Object.defineProperty(globalThis, "EventSource", {
      configurable: true,
      value: MockEventSource,
      writable: true,
    });
  });

  test("applies incoming parcel upserts without a full refresh", async () => {
    render(
      <RealtimeParcelListView
        actorRole="office_admin"
        parcels={[buildParcelListItem({ id: "parcel-1", parcelCode: "PF-001" })]}
        merchants={[]}
        riders={[]}
        townships={[]}
      />,
    );

    const eventSource = MockEventSource.instances[0];

    act(() => {
      eventSource.emit("parcel-upsert", {
        type: "parcel-upsert",
        parcel: buildParcelListItem({ id: "parcel-2", parcelCode: "PF-002" }),
      });
    });

    await waitFor(() => {
      expect(screen.getByText("PF-001,PF-002")).toBeTruthy();
    });
  });

  test("removes parcels that leave the admin scope", async () => {
    render(
      <RealtimeParcelListView
        actorRole="office_admin"
        parcels={[
          buildParcelListItem({ id: "parcel-1", parcelCode: "PF-001" }),
          buildParcelListItem({ id: "parcel-2", parcelCode: "PF-002" }),
        ]}
        merchants={[]}
        riders={[]}
        townships={[]}
      />,
    );

    const eventSource = MockEventSource.instances[0];

    act(() => {
      eventSource.emit("parcel-remove", {
        type: "parcel-remove",
        parcelId: "parcel-1",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("PF-002")).toBeTruthy();
    });
  });
});
