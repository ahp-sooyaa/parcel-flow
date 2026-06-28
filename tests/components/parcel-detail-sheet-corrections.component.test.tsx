import { beforeEach, describe, expect, mock, test } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { buildParcelListItem, buildRiderListItem } from "../fixtures/builders";

const correctParcelStatusActionMock = mock(async (_input: unknown) => ({
  ok: false,
  message: "Correction reason is required.",
}));
const correctParcelRiderActionMock = mock(async (_input: unknown) => ({
  ok: false,
  message: "This parcel status requires an active rider assignment.",
}));
const noopParcelActionMock = mock(async () => ({
  ok: true,
  message: "Parcel action completed.",
}));
const toastSuccessMock = mock(() => undefined);
const toastErrorMock = mock(() => undefined);

void mock.module("@/features/parcels/server/actions", () => ({
  assignParcelsToRiderAction: noopParcelActionMock,
  correctParcelRiderAction: correctParcelRiderActionMock,
  correctParcelStatusAction: correctParcelStatusActionMock,
  createParcelAction: noopParcelActionMock,
  deleteDeliveryFailureForRiderParcelAction: noopParcelActionMock,
  markRiderParcelReturnedToMerchantAction: noopParcelActionMock,
  postponeFailedParcelAction: noopParcelActionMock,
  reportDeliveryFailureForRiderParcelAction: noopParcelActionMock,
  returnFailedParcelToMerchantAction: noopParcelActionMock,
  startDeliveryForRiderParcelsAction: noopParcelActionMock,
  updateDeliveryFailureForRiderParcelAction: noopParcelActionMock,
  updateParcelAction: noopParcelActionMock,
}));

void mock.module("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

describe("ParcelDetailSheet corrections", async () => {
  const { ParcelDetailSheet } = await import("@/features/parcels/components/parcel-detail-sheet");

  beforeEach(() => {
    document.body.innerHTML = "";
    correctParcelStatusActionMock.mockReset();
    correctParcelRiderActionMock.mockReset();
    noopParcelActionMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    noopParcelActionMock.mockResolvedValue({
      ok: true,
      message: "Parcel action completed.",
    });
    correctParcelStatusActionMock.mockResolvedValue({
      ok: false,
      message: "Correction reason is required.",
    });
    correctParcelRiderActionMock.mockResolvedValue({
      ok: false,
      message: "This parcel status requires an active rider assignment.",
    });
  });

  test("renders correction dialogs and surfaces status correction errors", async () => {
    const user = userEvent.setup();

    render(
      <Sheet open>
        <SheetContent>
          <ParcelDetailSheet
            actorRole="office_admin"
            parcel={buildParcelListItem({
              id: "00000000-0000-4000-8000-000000000001",
              parcelCode: "PF-CORRECTION",
              status: "canceled_returned",
              riderId: "00000000-0000-4000-8000-000000000002",
              riderName: "Ko Rider",
              correctionStateToken: "state-token",
            })}
            riders={[
              buildRiderListItem({
                id: "00000000-0000-4000-8000-000000000002",
                name: "Ko Rider",
              }),
            ]}
          />
        </SheetContent>
      </Sheet>,
    );

    await user.click(screen.getByRole("button", { name: "Correct Status" }));

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Target status")).toBeTruthy();
    expect(screen.getByLabelText("Target status").textContent).toContain("Canceled");
    expect(screen.getAllByText("Rider").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Rider").textContent).toContain("Ko Rider");
    expect(screen.queryByText("canceled_returned")).toBeNull();
    expect(screen.queryByText("00000000-0000-4000-8000-000000000002")).toBeNull();
    expect(screen.getByText(/Review the current parcel, rider, and financial state/i)).toBeTruthy();
    expect(screen.getByText("Reason")).toBeTruthy();
    expect(getLastButton("Correct Status").disabled).toBe(true);

    await user.click(screen.getByLabelText("Target status"));
    await user.click(await screen.findByRole("option", { name: "Returned to Merchant" }));
    expect(getLastButton("Correct Status").disabled).toBe(false);

    await user.click(getLastButton("Correct Status"));

    await waitFor(() => {
      const submittedInput = correctParcelStatusActionMock.mock.calls.at(-1)?.[0];
      if (!(submittedInput instanceof FormData)) {
        throw new Error("Expected status correction to submit FormData.");
      }

      const submittedFormData = submittedInput;
      expect(submittedFormData.get("parcelId")).toBe("00000000-0000-4000-8000-000000000001");
      expect(submittedFormData.get("expectedStatus")).toBe("canceled_returned");
      expect(submittedFormData.get("expectedRiderId")).toBe("00000000-0000-4000-8000-000000000002");
      expect(submittedFormData.get("expectedFinancialItemsFingerprint")).toBe("state-token");
      expect(submittedFormData.get("targetStatus")).toBe("returned_to_merchant");
      expect(submittedFormData.get("targetRiderId")).toBe("00000000-0000-4000-8000-000000000002");
      expect(submittedFormData.get("reason")).toBe("");
    });
  });

  test("renders delivered correction proof upload and submits selected image", async () => {
    const user = userEvent.setup();

    render(
      <Sheet open>
        <SheetContent>
          <ParcelDetailSheet
            actorRole="office_admin"
            parcel={buildParcelListItem({
              id: "00000000-0000-4000-8000-000000000005",
              parcelCode: "PF-DELIVERED",
              status: "on_the_way",
              riderId: "00000000-0000-4000-8000-000000000006",
              riderName: "Delivery Rider",
              correctionStateToken: "delivered-state-token",
            })}
            riders={[
              buildRiderListItem({
                id: "00000000-0000-4000-8000-000000000006",
                name: "Delivery Rider",
              }),
            ]}
          />
        </SheetContent>
      </Sheet>,
    );

    await user.click(screen.getByRole("button", { name: "Correct Status" }));
    await user.click(screen.getByLabelText("Target status"));
    await user.click(await screen.findByRole("option", { name: "Delivered" }));

    expect(await screen.findByText("Delivery proof photo")).toBeTruthy();
    expect(screen.queryByText("Proof image key")).toBeNull();

    const proofInput = screen.getByLabelText("Delivery proof photo");
    const proof = new File(["proof"], "proof.jpg", { type: "image/jpeg" });
    await user.upload(proofInput, proof);

    expect(await screen.findByRole("img", { name: "Delivery proof preview" })).toBeTruthy();

    await user.click(getLastButton("Correct Status"));

    await waitFor(() => {
      const submittedInput = correctParcelStatusActionMock.mock.calls.at(-1)?.[0];
      if (!(submittedInput instanceof FormData)) {
        throw new Error("Expected status correction to submit FormData.");
      }

      const submittedFormData = submittedInput;
      expect(submittedFormData.get("expectedStatus")).toBe("on_the_way");
      expect(submittedFormData.get("expectedRiderId")).toBe("00000000-0000-4000-8000-000000000006");
      expect(submittedFormData.get("expectedFinancialItemsFingerprint")).toBe(
        "delivered-state-token",
      );
      expect(submittedFormData.get("targetStatus")).toBe("delivered");
      const submittedProof = submittedFormData.get("proofImage");
      if (!(submittedProof instanceof File)) {
        throw new Error("Expected status correction to submit a proof image.");
      }

      expect(submittedProof.name).toBe("proof.jpg");
      expect(submittedProof.type).toBe("image/jpeg");
      expect(submittedProof.size).toBe(proof.size);
    });
  });

  test("keeps status correction disabled for rider-only changes", async () => {
    const user = userEvent.setup();

    render(
      <Sheet open>
        <SheetContent>
          <ParcelDetailSheet
            actorRole="office_admin"
            parcel={buildParcelListItem({
              id: "00000000-0000-4000-8000-000000000007",
              parcelCode: "PF-STATUS-ONLY",
              status: "on_the_way",
              riderId: "00000000-0000-4000-8000-000000000008",
              riderName: "Current Rider",
              correctionStateToken: "status-only-token",
            })}
            riders={[
              buildRiderListItem({
                id: "00000000-0000-4000-8000-000000000008",
                name: "Current Rider",
              }),
              buildRiderListItem({
                id: "00000000-0000-4000-8000-000000000009",
                name: "New Rider",
              }),
            ]}
          />
        </SheetContent>
      </Sheet>,
    );

    await user.click(screen.getByRole("button", { name: "Correct Status" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(getLastButton("Correct Status").disabled).toBe(true);

    await user.click(screen.getByLabelText("Rider"));
    await user.click(await screen.findByRole("option", { name: "New Rider" }));

    expect(getLastButton("Correct Status").disabled).toBe(true);
    expect(correctParcelStatusActionMock).not.toHaveBeenCalled();
  });

  test("defaults canceled-returned status corrections to unassigned rider", async () => {
    const user = userEvent.setup();

    render(
      <Sheet open>
        <SheetContent>
          <ParcelDetailSheet
            actorRole="office_admin"
            parcel={buildParcelListItem({
              id: "00000000-0000-4000-8000-000000000010",
              parcelCode: "PF-CANCELED",
              status: "on_the_way",
              riderId: "00000000-0000-4000-8000-000000000011",
              riderName: "Current Rider",
              correctionStateToken: "canceled-state-token",
            })}
            riders={[
              buildRiderListItem({
                id: "00000000-0000-4000-8000-000000000011",
                name: "Current Rider",
              }),
            ]}
          />
        </SheetContent>
      </Sheet>,
    );

    await user.click(screen.getByRole("button", { name: "Correct Status" }));
    await user.click(screen.getByLabelText("Target status"));
    await user.click(await screen.findByRole("option", { name: "Canceled" }));

    expect(screen.getByLabelText("Rider").textContent).toContain("Unassigned");

    await user.click(getLastButton("Correct Status"));

    await waitFor(() => {
      const submittedInput = correctParcelStatusActionMock.mock.calls.at(-1)?.[0];
      if (!(submittedInput instanceof FormData)) {
        throw new Error("Expected status correction to submit FormData.");
      }

      expect(submittedInput.get("targetStatus")).toBe("canceled_returned");
      expect(submittedInput.get("targetRiderId")).toBe("");
    });
  });

  test("allows returned-to-merchant status correction without a rider", async () => {
    const user = userEvent.setup();

    render(
      <Sheet open>
        <SheetContent>
          <ParcelDetailSheet
            actorRole="office_admin"
            parcel={buildParcelListItem({
              id: "00000000-0000-4000-8000-000000000012",
              parcelCode: "PF-RETURNED",
              status: "canceled_returned",
              riderId: null,
              riderName: null,
              correctionStateToken: "returned-state-token",
            })}
            riders={[
              buildRiderListItem({
                id: "00000000-0000-4000-8000-000000000013",
                name: "Available Rider",
              }),
            ]}
          />
        </SheetContent>
      </Sheet>,
    );

    await user.click(screen.getByRole("button", { name: "Correct Status" }));
    await user.click(screen.getByLabelText("Target status"));
    await user.click(await screen.findByRole("option", { name: "Returned to Merchant" }));

    expect(screen.getByLabelText("Rider").textContent).toContain("Unassigned");

    await user.click(getLastButton("Correct Status"));

    await waitFor(() => {
      const submittedInput = correctParcelStatusActionMock.mock.calls.at(-1)?.[0];
      if (!(submittedInput instanceof FormData)) {
        throw new Error("Expected status correction to submit FormData.");
      }

      expect(submittedInput.get("targetStatus")).toBe("returned_to_merchant");
      expect(submittedInput.get("targetRiderId")).toBe("");
    });
  });

  test("renders rider correction dialog and allows unassigned target", async () => {
    const user = userEvent.setup();

    render(
      <Sheet open>
        <SheetContent>
          <ParcelDetailSheet
            actorRole="super_admin"
            parcel={buildParcelListItem({
              id: "00000000-0000-4000-8000-000000000003",
              parcelCode: "PF-RIDER",
              status: "at_office",
              riderId: "00000000-0000-4000-8000-000000000004",
              riderName: "Ma Rider",
              correctionStateToken: "rider-state-token",
            })}
            riders={[
              buildRiderListItem({
                id: "00000000-0000-4000-8000-000000000004",
                name: "Ma Rider",
              }),
            ]}
          />
        </SheetContent>
      </Sheet>,
    );

    await user.click(screen.getByRole("button", { name: "Correct Rider" }));

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Target rider")).toBeTruthy();
    expect(screen.getByText("Reason")).toBeTruthy();
    expect(getLastButton("Correct Rider").disabled).toBe(true);

    await user.click(screen.getByLabelText("Target rider"));
    await user.click(await screen.findByRole("option", { name: "Unassigned" }));

    expect(getLastButton("Correct Rider").disabled).toBe(false);

    await user.click(getLastButton("Correct Rider"));

    await waitFor(() => {
      expect(correctParcelRiderActionMock).toHaveBeenCalledWith({
        parcelId: "00000000-0000-4000-8000-000000000003",
        expectedStatus: "at_office",
        expectedRiderId: "00000000-0000-4000-8000-000000000004",
        expectedFinancialItemsFingerprint: "rider-state-token",
        targetRiderId: null,
        reason: "",
      });
    });
  });
});

function getLastButton(name: string) {
  const button = screen.getAllByRole("button", { name }).at(-1);

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`${name} button was not found.`);
  }

  return button;
}
