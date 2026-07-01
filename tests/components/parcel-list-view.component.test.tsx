import { beforeEach, describe, expect, mock, test } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type {
  AdminParcelListFiltersDto,
  AdminParcelListPageDto,
  ParcelListItemDto,
} from "@/features/parcels/server/dto";

import {
  buildParcelFailureNoteEntry,
  buildParcelListItem,
  buildRiderListItem,
} from "../fixtures/builders";

const routerPush = mock(() => {});

void mock.module("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
  usePathname: () => "/dashboard/parcels",
}));

const getAdminParcelDetailActionMock = mock(async (parcelId: string) => {
  const parcel = getAdminParcelDetailActionMockState.parcels.find((entry) => entry.id === parcelId);

  if (!parcel) {
    throw new Error("Parcel was not found.");
  }

  return parcel;
});
const noopParcelActionMock = mock(async () => ({
  ok: true,
  message: "Parcel action completed.",
}));

void mock.module("@/features/parcels/server/actions", () => ({
  assignParcelsToRiderAction: noopParcelActionMock,
  correctParcelRiderAction: noopParcelActionMock,
  correctParcelStatusAction: noopParcelActionMock,
  createParcelAction: noopParcelActionMock,
  deleteDeliveryFailureForRiderParcelAction: noopParcelActionMock,
  getAdminParcelDetailAction: getAdminParcelDetailActionMock,
  markRiderParcelReturnedToMerchantAction: noopParcelActionMock,
  postponeFailedParcelAction: noopParcelActionMock,
  reportDeliveryFailureForRiderParcelAction: noopParcelActionMock,
  returnFailedParcelToMerchantAction: noopParcelActionMock,
  startDeliveryForRiderParcelsAction: noopParcelActionMock,
  updateDeliveryFailureForRiderParcelAction: noopParcelActionMock,
  updateParcelAction: noopParcelActionMock,
}));

const getAdminParcelDetailActionMockState: { parcels: ParcelListItemDto[] } = {
  parcels: [],
};

function buildAdminPageResult(parcels: ParcelListItemDto[]): AdminParcelListPageDto {
  return {
    parcels,
    page: 1,
    pageSize: 25,
    totalCount: parcels.length,
    totalPages: 1,
    hasAnyParcels: parcels.length > 0,
    assignmentCounts: {
      all: parcels.length,
      unassigned: parcels.filter((parcel) => parcel.riderName === null).length,
      assigned: parcels.filter((parcel) => parcel.riderName !== null).length,
      need_review: parcels.filter((parcel) => parcel.activeFailureNote !== null).length,
    },
  };
}

const defaultFilters: AdminParcelListFiltersDto = {
  searchTerm: "",
  assignment: "all",
  townshipName: null,
  statuses: [],
  page: 1,
  pageSize: 25,
};

describe("ParcelListView", async () => {
  const { ParcelListView } = await import("@/features/parcels/components/parcel-list-view");

  beforeEach(() => {
    document.body.innerHTML = "";
    routerPush.mockClear();
    getAdminParcelDetailActionMockState.parcels = [];
  });

  test("navigates to the need review assignment filter tab", async () => {
    const user = userEvent.setup();
    const parcels = [
      buildParcelListItem({
        id: "needs-review",
        parcelCode: "PF-REVIEW",
        status: "on_the_way",
        riderName: "Ko Rider",
        failureNotes: [buildParcelFailureNoteEntry({ note: "Receiver asked to retry." })],
        hasUnresolvedFailureReview: true,
      }),
      buildParcelListItem({
        id: "normal",
        parcelCode: "PF-NORMAL",
        status: "at_office",
      }),
    ];
    getAdminParcelDetailActionMockState.parcels = parcels;

    render(
      <ParcelListView
        actorRole="office_admin"
        pageResult={buildAdminPageResult(parcels)}
        filters={defaultFilters}
        merchants={[]}
        riders={[]}
        townships={[]}
      />,
    );

    await user.click(screen.getByRole("tab", { name: /need review/i }));

    expect(routerPush).toHaveBeenCalledWith("/dashboard/parcels?assignment=need_review");
  });

  test("shows correction controls and history in the admin parcel detail sheet", async () => {
    const user = userEvent.setup();
    const parcels = [
      buildParcelListItem({
        id: "parcel-with-correction",
        parcelCode: "PF-CORRECT",
        riderId: "rider-1",
        riderName: "Ko Rider",
        correctionLogs: [
          {
            id: "correction-1",
            correctionType: "status",
            oldStatus: "delivered",
            newStatus: "on_the_way",
            oldRiderId: "rider-1",
            oldRiderName: "Ko Rider",
            newRiderId: "rider-1",
            newRiderName: "Ko Rider",
            reason: "Delivered status was selected by mistake.",
            sideEffects: { summary: ["Voided 1 pending financial item."] },
            createdByName: "Admin",
            createdAt: "2026-01-02",
          },
        ],
      }),
    ];
    getAdminParcelDetailActionMockState.parcels = parcels;

    render(
      <ParcelListView
        actorRole="super_admin"
        pageResult={buildAdminPageResult(parcels)}
        filters={defaultFilters}
        merchants={[]}
        riders={[buildRiderListItem({ id: "rider-1", name: "Ko Rider" })]}
        townships={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /open actions for pf-correct/i }));
    await user.click(await screen.findByText("View"));

    expect(await screen.findByText("Corrections")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Correct Status" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Correct Rider" })).toBeTruthy();
    expect(screen.getByText("Delivered -> On The Way")).toBeTruthy();
    expect(screen.getByText("Delivered status was selected by mistake.")).toBeTruthy();
  });

  test("loads parcel detail from the server when a row is opened", async () => {
    const user = userEvent.setup();
    const parcel = buildParcelListItem({
      id: "parcel-refresh",
      parcelCode: "PF-REFRESH",
      status: "delivered",
      riderId: "rider-1",
      riderName: "Ko Rider",
    });
    getAdminParcelDetailActionMockState.parcels = [parcel];

    render(
      <ParcelListView
        actorRole="super_admin"
        pageResult={buildAdminPageResult([parcel])}
        filters={defaultFilters}
        merchants={[]}
        riders={[buildRiderListItem({ id: "rider-1", name: "Ko Rider" })]}
        townships={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /open actions for pf-refresh/i }));
    await user.click(await screen.findByText("View"));

    await waitFor(() => {
      expect(screen.getAllByText("Delivered").length).toBeGreaterThan(0);
    });
  });
});
