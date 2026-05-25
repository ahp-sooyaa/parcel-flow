import { beforeEach, describe, expect, mock, test } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { buildParcelFailureNoteEntry, buildParcelListItem } from "../fixtures/builders";

const postponeFailedParcelActionMock = mock(async () => ({
  ok: true,
  message: "Parcel postponed for retry.",
}));
const returnFailedParcelToMerchantActionMock = mock(async () => ({
  ok: true,
  message: "Parcel marked for merchant return.",
}));

void mock.module("@/features/parcels/server/actions", () => ({
  postponeFailedParcelAction: postponeFailedParcelActionMock,
  returnFailedParcelToMerchantAction: returnFailedParcelToMerchantActionMock,
}));

describe("ParcelTable", async () => {
  const { ParcelTable } = await import("@/features/parcels/components/parcel-table");

  beforeEach(() => {
    postponeFailedParcelActionMock.mockReset();
    returnFailedParcelToMerchantActionMock.mockReset();
    postponeFailedParcelActionMock.mockResolvedValue({
      ok: true,
      message: "Parcel postponed for retry.",
    });
    returnFailedParcelToMerchantActionMock.mockResolvedValue({
      ok: true,
      message: "Parcel marked for merchant return.",
    });
  });

  test("renders empty state", () => {
    render(<ParcelTable parcels={[]} />);

    expect(screen.getByText("No parcels match the current search and filters.")).toBeTruthy();
  });

  test("disables assignment selection for already assigned parcels", () => {
    render(
      <ParcelTable
        enableSelection
        parcels={[
          buildParcelListItem({ id: "eligible", parcelCode: "PF-ELIGIBLE", riderName: null }),
          buildParcelListItem({
            id: "assigned",
            parcelCode: "PF-ASSIGNED",
            riderName: "Assigned Rider",
          }),
        ]}
      />,
    );

    expect(screen.getByLabelText("Select PF-ELIGIBLE").getAttribute("data-disabled")).toBeNull();
    expect(
      screen.getByLabelText("Select PF-ASSIGNED").getAttribute("data-disabled"),
    ).not.toBeNull();
  });

  test("emits selected parcel IDs when selection changes", async () => {
    const user = userEvent.setup();
    const onSelectedParcelIdsChange = mock(() => undefined);
    render(
      <ParcelTable
        enableSelection
        parcels={[buildParcelListItem({ id: "parcel-1", parcelCode: "PF-000001" })]}
        selectedParcelIds={[]}
        onSelectedParcelIdsChange={onSelectedParcelIdsChange}
      />,
    );

    await user.click(screen.getByLabelText("Select PF-000001"));

    expect(onSelectedParcelIdsChange).toHaveBeenCalledWith(["parcel-1"]);
  });

  test("select-all only includes eligible parcel ids", async () => {
    const user = userEvent.setup();
    const onSelectedParcelIdsChange = mock(() => undefined);
    render(
      <ParcelTable
        enableSelection
        parcels={[
          buildParcelListItem({ id: "at-office", parcelCode: "PF-AT-OFFICE", status: "at_office" }),
          buildParcelListItem({ id: "postpone", parcelCode: "PF-POSTPONE", status: "postpone" }),
          buildParcelListItem({
            id: "delivered",
            parcelCode: "PF-DELIVERED",
            status: "delivered",
          }),
        ]}
        selectedParcelIds={[]}
        onSelectedParcelIdsChange={onSelectedParcelIdsChange}
      />,
    );

    await user.click(screen.getByLabelText("Select all parcels"));

    expect(onSelectedParcelIdsChange).toHaveBeenCalledWith(["at-office", "postpone"]);
  });

  test("shows failure review icon only when enabled for unresolved failed parcels", () => {
    const failedParcel = buildParcelListItem({
      parcelCode: "PF-FAILED",
      status: "on_the_way",
      riderName: "Ko Rider",
      failureNotes: [buildParcelFailureNoteEntry({ note: "Receiver was not available." })],
      hasUnresolvedFailureReview: true,
    });

    const { rerender } = render(<ParcelTable parcels={[failedParcel]} />);

    expect(screen.queryByLabelText("Review failure note for PF-FAILED")).toBeNull();

    rerender(<ParcelTable parcels={[failedParcel]} enableFailureReview />);

    expect(screen.getByLabelText("Review failure note for PF-FAILED")).toBeTruthy();
  });

  test("opens failure review dialog and submits postpone action", async () => {
    const user = userEvent.setup();
    render(
      <ParcelTable
        enableFailureReview
        parcels={[
          buildParcelListItem({
            id: "parcel-1",
            parcelCode: "PF-FAILED",
            status: "on_the_way",
            riderName: "Ko Rider",
            failureNotes: [buildParcelFailureNoteEntry({ note: "Receiver was not available." })],
            hasUnresolvedFailureReview: true,
          }),
        ]}
      />,
    );

    await user.click(screen.getByLabelText("Review failure note for PF-FAILED"));

    expect(screen.getByRole("heading", { name: "Delivery Failure" })).toBeTruthy();
    expect(screen.getByDisplayValue("Receiver was not available.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Postpone" }));

    await waitFor(() => {
      expect(postponeFailedParcelActionMock).toHaveBeenCalledWith({ parcelId: "parcel-1" });
    });
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Delivery Failure" })).toBeNull();
    });
  });

  test("submits return merchant action and keeps dialog open on errors", async () => {
    const user = userEvent.setup();
    returnFailedParcelToMerchantActionMock.mockResolvedValueOnce({
      ok: false,
      message: "This failure report has already been handled.",
    });

    render(
      <ParcelTable
        enableFailureReview
        parcels={[
          buildParcelListItem({
            id: "parcel-1",
            parcelCode: "PF-FAILED",
            status: "on_the_way",
            riderName: "Ko Rider",
            failureNotes: [buildParcelFailureNoteEntry({ note: "Receiver was not available." })],
            hasUnresolvedFailureReview: true,
          }),
        ]}
      />,
    );

    await user.click(screen.getByLabelText("Review failure note for PF-FAILED"));
    await user.click(screen.getByRole("button", { name: "Return Merchant" }));

    await waitFor(() => {
      expect(returnFailedParcelToMerchantActionMock).toHaveBeenCalledWith({ parcelId: "parcel-1" });
    });
    expect(await screen.findByText("This failure report has already been handled.")).toBeTruthy();
  });
});
