import { beforeEach, describe, expect, mock, test } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { buildParcelFailureNoteEntry, buildParcelListItem } from "../fixtures/builders";

const toastSuccessMock = mock(() => undefined);
const toastErrorMock = mock(() => undefined);
const refreshMock = mock(() => undefined);
const startDeliveryForRiderParcelsActionMock = mock(async () => ({
  ok: true,
  message: "Parcel moved to on the way.",
}));
const reportDeliveryFailureForRiderParcelActionMock = mock(async () => ({
  ok: true,
  message: "Delivery failure reported.",
}));
const updateDeliveryFailureForRiderParcelActionMock = mock(async () => ({
  ok: true,
  message: "Delivery failure note updated.",
}));
const deleteDeliveryFailureForRiderParcelActionMock = mock(async () => ({
  ok: true,
  message: "Delivery failure note deleted.",
}));
const markRiderParcelReturnedToMerchantActionMock = mock(async () => ({
  ok: true,
  message: "Parcel returned to merchant.",
}));
let deliveredRequestInput: BodyInit | null | undefined;
const fetchMock: typeof fetch = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
  deliveredRequestInput = init?.body;

  return new Response(JSON.stringify({ ok: true, message: "Parcel marked delivered." }), {
    headers: {
      "Content-Type": "application/json",
    },
  });
});

void mock.module("@/lib/client-navigation", () => ({
  useAppRouter: () => ({
    refresh: refreshMock,
  }),
}));

void mock.module("@/features/parcels/server/actions", () => ({
  deleteDeliveryFailureForRiderParcelAction: deleteDeliveryFailureForRiderParcelActionMock,
  markRiderParcelReturnedToMerchantAction: markRiderParcelReturnedToMerchantActionMock,
  reportDeliveryFailureForRiderParcelAction: reportDeliveryFailureForRiderParcelActionMock,
  startDeliveryForRiderParcelsAction: startDeliveryForRiderParcelsActionMock,
  updateDeliveryFailureForRiderParcelAction: updateDeliveryFailureForRiderParcelActionMock,
}));

void mock.module("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

describe("RiderParcelCardList", async () => {
  const { RiderParcelCardList } =
    await import("@/features/parcels/components/rider-parcel-card-list");

  beforeEach(() => {
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    refreshMock.mockReset();
    startDeliveryForRiderParcelsActionMock.mockReset();
    reportDeliveryFailureForRiderParcelActionMock.mockReset();
    updateDeliveryFailureForRiderParcelActionMock.mockReset();
    deleteDeliveryFailureForRiderParcelActionMock.mockReset();
    markRiderParcelReturnedToMerchantActionMock.mockReset();
    fetchMock.mockReset();
    deliveredRequestInput = undefined;
    startDeliveryForRiderParcelsActionMock.mockResolvedValue({
      ok: true,
      message: "Parcel moved to on the way.",
    });
    reportDeliveryFailureForRiderParcelActionMock.mockResolvedValue({
      ok: true,
      message: "Delivery failure reported.",
    });
    updateDeliveryFailureForRiderParcelActionMock.mockResolvedValue({
      ok: true,
      message: "Delivery failure note updated.",
    });
    deleteDeliveryFailureForRiderParcelActionMock.mockResolvedValue({
      ok: true,
      message: "Delivery failure note deleted.",
    });
    markRiderParcelReturnedToMerchantActionMock.mockResolvedValue({
      ok: true,
      message: "Parcel returned to merchant.",
    });
    fetchMock.mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
      deliveredRequestInput = init?.body;

      return new Response(JSON.stringify({ ok: true, message: "Parcel marked delivered." }), {
        headers: {
          "Content-Type": "application/json",
        },
      });
    });
    globalThis.fetch = fetchMock;
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

    await user.click(screen.getByRole("button", { name: "Report Failure" }));
    await user.type(screen.getByLabelText("Failure note"), "Receiver was not available.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(reportDeliveryFailureForRiderParcelActionMock).toHaveBeenCalledWith({
        parcelId: "00000000-0000-4000-8000-000000000001",
        note: "Receiver was not available.",
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Delivery failure reported.", {
      description: undefined,
      id: "success:Delivery failure reported.:",
      position: "top-center",
    });
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
            failureNotes: [
              buildParcelFailureNoteEntry({ note: "Receiver asked to call tomorrow." }),
            ],
          }),
        ]}
      />,
    );

    expect(screen.queryByRole("button", { name: "Report Failure" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mark Delivered" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "View Failure Note" }));
    expect(screen.getByRole("heading", { name: "Failure Note" })).toBeTruthy();
    expect(screen.getByDisplayValue("Receiver asked to call tomorrow.")).toBeTruthy();
  });

  test("allows riders to edit an existing active failure note", async () => {
    const user = userEvent.setup();
    render(
      <RiderParcelCardList
        parcels={[
          buildParcelListItem({
            id: "00000000-0000-4000-8000-000000000001",
            parcelCode: "PF-NOTE",
            status: "on_the_way",
            failureNotes: [
              buildParcelFailureNoteEntry({ note: "Receiver asked to call tomorrow." }),
            ],
          }),
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "View Failure Note" }));

    const noteField = screen.getByLabelText("Failure note");
    await user.clear(noteField);
    await user.type(noteField, "Updated note");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateDeliveryFailureForRiderParcelActionMock).toHaveBeenCalledWith({
        parcelId: "00000000-0000-4000-8000-000000000001",
        note: "Updated note",
      });
    });
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
      expect(fetchMock).toHaveBeenCalled();
    });

    if (!(deliveredRequestInput instanceof FormData)) {
      throw new Error("Mark delivered request was not called with form data.");
    }

    const submittedProof = deliveredRequestInput.get("proofImage");
    expect(deliveredRequestInput.get("parcelId")).toBe("00000000-0000-4000-8000-000000000001");
    expect(submittedProof).toBeInstanceOf(File);

    if (!(submittedProof instanceof File)) {
      throw new Error("Proof image was not submitted as a file.");
    }

    expect(submittedProof.name).toBe("proof.jpg");
    expect(submittedProof.type).toBe("image/jpeg");
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Save Delivery" })).toBeNull();
    });
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

    await user.click(screen.getByRole("button", { name: "Return to Merchant" }));

    await waitFor(() => {
      expect(markRiderParcelReturnedToMerchantActionMock).toHaveBeenCalledWith({
        parcelId: "00000000-0000-4000-8000-000000000001",
      });
    });

    expect(toastSuccessMock).toHaveBeenCalledWith("Parcel returned to merchant.", {
      description: undefined,
      id: "success:Parcel returned to merchant.:",
      position: "top-center",
    });
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

  test("renders rider parcel cards expanded by default", () => {
    render(
      <RiderParcelCardList
        parcels={[
          buildParcelListItem({
            parcelCode: "PF-EXPANDED",
            receiverPhoneNumber: "09123456789",
            receiverAddress: "Expanded address",
          }),
        ]}
      />,
    );

    expect(screen.getByText("09123456789")).toBeTruthy();
    expect(screen.getByText("Expanded address")).toBeTruthy();
    expect(screen.getByRole("button", { name: "View details" })).toBeTruthy();
  });
});
