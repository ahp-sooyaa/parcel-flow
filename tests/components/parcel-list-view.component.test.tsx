import { beforeEach, describe, expect, test } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  buildParcelFailureNoteEntry,
  buildParcelListItem,
  buildRiderListItem,
} from "../fixtures/builders";

describe("ParcelListView", async () => {
  const { ParcelListView } = await import("@/features/parcels/components/parcel-list-view");

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("filters the admin list to active failure-note parcels in the need review tab", async () => {
    const user = userEvent.setup();

    render(
      <ParcelListView
        actorRole="office_admin"
        parcels={[
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
        ]}
        merchants={[]}
        riders={[]}
        townships={[]}
      />,
    );

    expect(screen.getByText("PF-REVIEW")).toBeTruthy();
    expect(screen.getByText("PF-NORMAL")).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: /need review/i }));

    await waitFor(() => {
      expect(screen.getByText("PF-REVIEW")).toBeTruthy();
      expect(screen.queryByText("PF-NORMAL")).toBeNull();
    });
  });

  test("shows correction controls and history in the admin parcel detail sheet", async () => {
    const user = userEvent.setup();

    render(
      <ParcelListView
        actorRole="super_admin"
        parcels={[
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
        ]}
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

  test("keeps an open parcel detail sheet synced with refreshed parcel data", async () => {
    const user = userEvent.setup();
    const parcel = buildParcelListItem({
      id: "parcel-refresh",
      parcelCode: "PF-REFRESH",
      status: "delivered",
      riderId: "rider-1",
      riderName: "Ko Rider",
    });
    const { rerender } = render(
      <ParcelListView
        actorRole="super_admin"
        parcels={[parcel]}
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

    rerender(
      <ParcelListView
        actorRole="super_admin"
        parcels={[{ ...parcel, status: "on_the_way" }]}
        merchants={[]}
        riders={[buildRiderListItem({ id: "rider-1", name: "Ko Rider" })]}
        townships={[]}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByText("On The Way").length).toBeGreaterThan(0);
    });
  });
});
