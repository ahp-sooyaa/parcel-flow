import { beforeEach, describe, expect, mock, test } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { buildParcelFailureNoteEntry, buildParcelListItem } from "../fixtures/builders";

const refreshMock = mock(() => undefined);
const startDeliveryForRiderParcelsActionMock = mock(async () => ({
  ok: true,
  message: "Parcel moved to on the way.",
}));
const reportDeliveryFailureForRiderParcelActionMock = mock(async () => ({
  ok: true,
  message: "Delivery failure reported.",
}));
const markRiderParcelReturnedToMerchantActionMock = mock(async () => ({
  ok: true,
  message: "Parcel returned to merchant.",
}));
let deliveredActionInput: unknown;
const markRiderParcelDeliveredActionMock = mock(async (input: unknown) => {
  deliveredActionInput = input;

  return {
    ok: true,
    message: "Parcel marked delivered.",
  };
});

void mock.module("@/lib/client-navigation", () => ({
  useAppRouter: () => ({
    refresh: refreshMock,
  }),
}));

void mock.module("@/features/parcels/server/actions", () => ({
  markRiderParcelDeliveredAction: markRiderParcelDeliveredActionMock,
  markRiderParcelReturnedToMerchantAction: markRiderParcelReturnedToMerchantActionMock,
  reportDeliveryFailureForRiderParcelAction: reportDeliveryFailureForRiderParcelActionMock,
  startDeliveryForRiderParcelsAction: startDeliveryForRiderParcelsActionMock,
}));

describe("RiderParcelCardList", async () => {
  const { RiderParcelCardList } =
    await import("@/features/parcels/components/rider-parcel-card-list");

  beforeEach(() => {
    refreshMock.mockReset();
    startDeliveryForRiderParcelsActionMock.mockReset();
    reportDeliveryFailureForRiderParcelActionMock.mockReset();
    markRiderParcelDeliveredActionMock.mockReset();
    markRiderParcelReturnedToMerchantActionMock.mockReset();
    deliveredActionInput = undefined;
    startDeliveryForRiderParcelsActionMock.mockResolvedValue({
      ok: true,
      message: "Parcel moved to on the way.",
    });
    reportDeliveryFailureForRiderParcelActionMock.mockResolvedValue({
      ok: true,
      message: "Delivery failure reported.",
    });
    markRiderParcelReturnedToMerchantActionMock.mockResolvedValue({
      ok: true,
      message: "Parcel returned to merchant.",
    });
    markRiderParcelDeliveredActionMock.mockImplementation(async (input: unknown) => {
      deliveredActionInput = input;

      return {
        ok: true,
        message: "Parcel marked delivered.",
      };
    });
    globalThis.URL.createObjectURL = mock(() => "blob:proof-preview") as typeof URL.createObjectURL;
    globalThis.URL.revokeObjectURL = mock(() => undefined) as typeof URL.revokeObjectURL;
  });

  test("opens failure dialog and submits rider failure note", async () => {
    const user = userEvent.setup();
    render(
      <RiderParcelCardList
        parcels={[
          buildParcelListItem({
            id: "00000000-0000-4000-8000-000000000001",
            parcelCode: "PF-FAILURE",
            status: "on_the_way",
          }),
        ]}
      />,
    );

    await user.click(screen.getByText("Receiver"));
    await user.click(screen.getByRole("button", { name: "Report Failure" }));
    await user.type(screen.getByLabelText("Failure note"), "Receiver was not available.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(reportDeliveryFailureForRiderParcelActionMock).toHaveBeenCalledWith({
        parcelId: "00000000-0000-4000-8000-000000000001",
        note: "Receiver was not available.",
      });
    });
    expect(await screen.findByText("Delivery failure reported.")).toBeTruthy();
    expect(refreshMock).toHaveBeenCalled();
  });

  test("shows existing failure note management and suppresses delivery actions", async () => {
    const user = userEvent.setup();
    render(
      <RiderParcelCardList
        parcels={[
          buildParcelListItem({
            id: "00000000-0000-4000-8000-000000000001",
            parcelCode: "PF-NOTE",
            status: "on_the_way",
            failureNotes: [buildParcelFailureNoteEntry({ note: "Receiver asked to call tomorrow." })],
          }),
        ]}
      />,
    );

    await user.click(screen.getByText("Receiver"));

    expect(screen.queryByRole("button", { name: "Report Failure" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mark Delivered" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "View Failure Note" }));
    expect(screen.getByRole("heading", { name: "Failure Note" })).toBeTruthy();
    expect(screen.getByText("Receiver asked to call tomorrow.")).toBeTruthy();
  });

  test("shows existing active failure note in review mode without save controls", async () => {
    const user = userEvent.setup();
    render(
      <RiderParcelCardList
        parcels={[
          buildParcelListItem({
            id: "00000000-0000-4000-8000-000000000001",
            parcelCode: "PF-NOTE",
            status: "on_the_way",
            failureNotes: [buildParcelFailureNoteEntry({ note: "Receiver asked to call tomorrow." })],
          }),
        ]}
      />,
    );

    await user.click(screen.getByText("Receiver"));
    await user.click(screen.getByRole("button", { name: "View Failure Note" }));

    expect(screen.getByText("Receiver asked to call tomorrow.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Close" }).length).toBeGreaterThan(0);
  });

  test("opens mark delivered dialog, previews proof, and submits form data", async () => {
    const user = userEvent.setup();
    render(
      <RiderParcelCardList
        parcels={[
          buildParcelListItem({
            id: "00000000-0000-4000-8000-000000000001",
            parcelCode: "PF-DELIVERED",
            status: "on_the_way",
            codAmount: 10_000,
            deliveryFee: 2_000,
          }),
        ]}
      />,
    );

    await user.click(screen.getByText("Receiver"));
    await user.click(screen.getByRole("button", { name: "Mark Delivered" }));
    expect(screen.getAllByText("12,000 MMK").length).toBeGreaterThanOrEqual(1);

    const proofInput = document.querySelector("input[name='proofImage']");

    if (!(proofInput instanceof HTMLInputElement)) {
      throw new Error("Proof input was not rendered.");
    }

    const proof = new File(["proof"], "proof.jpg", { type: "image/jpeg" });
    await user.upload(proofInput, proof);

    expect(screen.getByRole("img", { name: "Delivery proof preview" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Save Delivery" }));

    await waitFor(() => {
      expect(markRiderParcelDeliveredActionMock).toHaveBeenCalled();
    });

    if (!(deliveredActionInput instanceof FormData)) {
      throw new Error("Mark delivered action was not called with form data.");
    }

    const submittedProof = deliveredActionInput.get("proofImage");
    expect(deliveredActionInput.get("parcelId")).toBe("00000000-0000-4000-8000-000000000001");
    expect(submittedProof).toBeInstanceOf(File);

    if (!(submittedProof instanceof File)) {
      throw new Error("Proof image was not submitted as a file.");
    }

    expect(submittedProof.name).toBe("proof.jpg");
    expect(submittedProof.type).toBe("image/jpeg");
    expect(await screen.findByText("Parcel marked delivered.")).toBeTruthy();
    expect(refreshMock).toHaveBeenCalled();
  });

  test("shows return action for canceled-returned parcel and completes it", async () => {
    const user = userEvent.setup();
    render(
      <RiderParcelCardList
        parcels={[
          buildParcelListItem({
            id: "00000000-0000-4000-8000-000000000001",
            parcelCode: "PF-RETURN",
            status: "canceled_returned",
          }),
        ]}
      />,
    );

    await user.click(screen.getByText("Receiver"));
    await user.click(screen.getByRole("button", { name: "Return to Merchant" }));

    await waitFor(() => {
      expect(markRiderParcelReturnedToMerchantActionMock).toHaveBeenCalledWith({
        parcelId: "00000000-0000-4000-8000-000000000001",
      });
    });

    expect(await screen.findByText("Parcel returned to merchant.")).toBeTruthy();
    expect(refreshMock).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Mark Delivered" })).toBeNull();
  });

  test("shows returned-to-merchant parcels in the returned tab", async () => {
    const user = userEvent.setup();
    render(
      <RiderParcelCardList
        parcels={[
          buildParcelListItem({
            id: "00000000-0000-4000-8000-000000000001",
            parcelCode: "PF-RETURNED",
            status: "returned_to_merchant",
          }),
        ]}
      />,
    );

    expect(screen.getByRole("tab", { name: /Returned 1/i })).toBeTruthy();
    expect(screen.queryByText("PF-RETURNED")).toBeNull();

    await user.click(screen.getByRole("tab", { name: /Returned 1/i }));

    expect(screen.getByText("PF-RETURNED")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Return to Merchant" })).toBeNull();
  });
});
