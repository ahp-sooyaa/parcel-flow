import { beforeEach, describe, expect, mock, test } from "bun:test";
import { cloneElement, type ReactElement, useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { buildParcelListItem, buildRiderListItem } from "../fixtures/builders";

const toastSuccessMock = mock(() => undefined);
const toastErrorMock = mock(() => undefined);
const assignParcelsToRiderActionMock = mock(async () => ({
  ok: true,
  message: "Parcels assigned.",
}));

void mock.module("@/features/parcels/server/actions", () => ({
  assignParcelsToRiderAction: assignParcelsToRiderActionMock,
}));

void mock.module("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

describe("AssignRiderDialog", async () => {
  const { AssignRiderDialog } = await import("@/features/parcels/components/assign-rider-dialog");

  beforeEach(() => {
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    assignParcelsToRiderActionMock.mockReset();
    assignParcelsToRiderActionMock.mockResolvedValue({
      ok: true,
      message: "Parcels assigned.",
    });
  });

  test("renders selected parcel and expected collection summary", () => {
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
    expect(screen.getByText("Total expected collection")).toBeTruthy();
    expect(screen.queryByText("Selected parcels")).toBeNull();
    expect(getButton("Assign Rider").disabled).toBe(true);
  });

  test("submits the selected rider and parcel ids on success", async () => {
    const user = userEvent.setup();
    const onOpenChange = mock(() => undefined);

    renderWithControlledOpen(
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

    await waitFor(() => {
      expect(assignParcelsToRiderActionMock).toHaveBeenCalledWith({
        riderId: "rider-1",
        parcelIds: ["parcel-1", "parcel-2"],
      });
    });
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Assign Rider" })).toBeNull();
    });
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

    expect(toastErrorMock).toHaveBeenCalledWith("Active rider was not found.", {
      description: undefined,
      id: "error:Active rider was not found.:",
      position: "top-center",
    });
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

function renderWithControlledOpen(
  dialog: ReactElement<{ open: boolean; onOpenChange: (open: boolean) => void }>,
) {
  function ControlledDialogHost() {
    const [open, setOpen] = useState(true);

    return cloneElement(dialog, {
      ...dialog.props,
      open,
      onOpenChange: (nextOpen: boolean) => {
        dialog.props.onOpenChange(nextOpen);
        setOpen(nextOpen);
      },
    });
  }

  return render(<ControlledDialogHost />);
}
