import { beforeEach, describe, expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { buildParcelListItem, buildRiderListItem } from "../fixtures/builders";

const assignParcelsToRiderActionMock = mock(async () => ({
  ok: true,
  message: "Parcels assigned.",
}));

void mock.module("@/features/parcels/server/actions", () => ({
  assignParcelsToRiderAction: assignParcelsToRiderActionMock,
}));

describe("AssignRiderDialog", async () => {
  const { AssignRiderDialog } = await import("@/features/parcels/components/assign-rider-dialog");

  beforeEach(() => {
    assignParcelsToRiderActionMock.mockReset();
    assignParcelsToRiderActionMock.mockResolvedValue({
      ok: true,
      message: "Parcels assigned.",
    });
  });

  test("renders selected parcel and collection summary", () => {
    render(
      <AssignRiderDialog
        open
        onOpenChange={() => undefined}
        selectedParcels={[
          buildParcelListItem({
            id: "parcel-1",
            parcelCode: "PF-000001",
            codAmount: 10_000,
            deliveryFee: 2_000,
          }),
        ]}
        riders={[buildRiderListItem({ id: "rider-1", name: "Ko Rider" })]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Assign Rider" })).toBeTruthy();
    expect(screen.getByText("PF-000001")).toBeTruthy();
    expect(screen.getByText("Selected parcels")).toBeTruthy();
    expect(screen.getByText("Total expected collection")).toBeTruthy();
    expect(getButton("Assign Rider").disabled).toBe(true);
  });

  test("submits the selected rider and parcel ids on success", async () => {
    const user = userEvent.setup();
    const onOpenChange = mock(() => undefined);

    render(
      <AssignRiderDialog
        open
        onOpenChange={onOpenChange}
        selectedParcels={[
          buildParcelListItem({
            id: "parcel-1",
            parcelCode: "PF-000001",
            codAmount: 10_000,
            deliveryFee: 2_000,
          }),
          buildParcelListItem({
            id: "parcel-2",
            parcelCode: "PF-000002",
            codAmount: 0,
            deliveryFee: 1_000,
          }),
        ]}
        riders={[buildRiderListItem({ id: "rider-1", name: "Ko Rider" })]}
      />,
    );

    await user.type(screen.getByLabelText("Search rider"), "ko");
    await user.click(screen.getByRole("option", { name: /ko rider/i }));
    await user.click(getButton("Assign Rider"));

    expect(assignParcelsToRiderActionMock).toHaveBeenCalledWith({
      riderId: "rider-1",
      parcelIds: ["parcel-1", "parcel-2"],
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("shows action errors instead of closing the dialog", async () => {
    const user = userEvent.setup();
    const onOpenChange = mock(() => undefined);
    assignParcelsToRiderActionMock.mockResolvedValueOnce({
      ok: false,
      message: "Active rider was not found.",
    });

    render(
      <AssignRiderDialog
        open
        onOpenChange={onOpenChange}
        selectedParcels={[buildParcelListItem({ id: "parcel-1", parcelCode: "PF-000001" })]}
        riders={[buildRiderListItem({ id: "rider-1", name: "Ko Rider" })]}
      />,
    );

    await user.type(screen.getByLabelText("Search rider"), "ko");
    await user.click(screen.getByRole("option", { name: /ko rider/i }));
    await user.click(getButton("Assign Rider"));

    expect(screen.getByText("Active rider was not found.")).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

function getButton(name: string) {
  const element = screen.getByRole("button", { name });

  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`${name} is not a button.`);
  }

  return element;
}
