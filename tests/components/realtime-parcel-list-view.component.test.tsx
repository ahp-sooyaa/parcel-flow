import { beforeEach, describe, expect, mock, test } from "bun:test";
import { act, render, screen, waitFor } from "@testing-library/react";

import type {
  AdminParcelListFiltersDto,
  AdminParcelListPageDto,
} from "@/features/parcels/server/dto";

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
  ParcelListView: ({ pageResult }: { pageResult: AdminParcelListPageDto }) => (
    <div>{pageResult.parcels.map((parcel) => parcel.parcelCode).join(",")}</div>
  ),
}));

const defaultFilters: AdminParcelListFiltersDto = {
  searchTerm: "",
  assignment: "all",
  townshipName: null,
  statuses: [],
  page: 1,
  pageSize: 25,
};

function buildAdminPageResult(
  parcels: ReturnType<typeof buildParcelListItem>[],
): AdminParcelListPageDto {
  return {
    parcels,
    page: 1,
    pageSize: 25,
    totalCount: parcels.length,
    totalPages: 1,
    hasAnyParcels: parcels.length > 0,
    assignmentCounts: {
      all: parcels.length,
      unassigned: 0,
      assigned: parcels.length,
      need_review: 0,
    },
  };
}

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
        pageResult={buildAdminPageResult([
          buildParcelListItem({ id: "parcel-1", parcelCode: "PF-001" }),
        ])}
        filters={defaultFilters}
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
        pageResult={buildAdminPageResult([
          buildParcelListItem({ id: "parcel-1", parcelCode: "PF-001" }),
          buildParcelListItem({ id: "parcel-2", parcelCode: "PF-002" }),
        ])}
        filters={defaultFilters}
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

  test("removes need-review parcels when a realtime upsert resolves the failure", async () => {
    render(
      <RealtimeParcelListView
        actorRole="office_admin"
        pageResult={buildAdminPageResult([
          buildParcelListItem({
            id: "parcel-1",
            parcelCode: "PF-FAILED",
            status: "on_the_way",
            riderName: "Ko Rider",
            hasUnresolvedFailureReview: true,
          }),
        ])}
        filters={{ ...defaultFilters, assignment: "need_review" }}
        merchants={[]}
        riders={[]}
        townships={[]}
      />,
    );

    const eventSource = MockEventSource.instances[0];

    act(() => {
      eventSource.emit("parcel-upsert", {
        type: "parcel-upsert",
        parcel: buildParcelListItem({
          id: "parcel-1",
          parcelCode: "PF-FAILED",
          status: "postpone",
          riderName: null,
          hasUnresolvedFailureReview: false,
        }),
      });
    });

    await waitFor(() => {
      expect(screen.queryByText("PF-FAILED")).toBeNull();
    });
  });
});
