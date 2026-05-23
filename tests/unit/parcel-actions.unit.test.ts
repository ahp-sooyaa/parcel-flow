import { beforeEach, describe, expect, mock, test } from "bun:test";

import { buildCurrentUser } from "../fixtures/builders";

const requireCurrentUserMock = mock(async () => buildCurrentUser({ role: "super_admin" }));
const createParcelMock = mock(async () => ({ id: "parcel-id", parcelCode: "PF-000001-000001" }));
const assignParcelsToRiderMock = mock(async () => undefined);
const startDeliveryForRiderParcelsMock = mock(async () => undefined);
const reportDeliveryFailureForRiderParcelMock = mock(async () => undefined);
const updateDeliveryFailureForRiderParcelMock = mock(async () => undefined);
const deleteDeliveryFailureForRiderParcelMock = mock(async () => undefined);
const markRiderParcelDeliveredMock = mock(async () => undefined);
const markRiderParcelReturnedToMerchantMock = mock(async () => undefined);
const resolveFailedParcelByAdminMock = mock(async () => undefined);
const updateParcelMock = mock(async () => undefined);
const uploadDeliveryProofImageMock = mock(
  async () => "parcels/parcel-id/proof-of-delivery/proof.jpg",
);
const revalidatePathMock = mock(() => undefined);

void mock.module("@/lib/session", () => ({
  requireCurrentUser: requireCurrentUserMock,
}));

void mock.module("@/features/parcels/server/dal", () => ({
  assignParcelsToRider: assignParcelsToRiderMock,
  createParcel: createParcelMock,
  deleteDeliveryFailureForRiderParcel: deleteDeliveryFailureForRiderParcelMock,
  markRiderParcelDelivered: markRiderParcelDeliveredMock,
  markRiderParcelReturnedToMerchant: markRiderParcelReturnedToMerchantMock,
  reportDeliveryFailureForRiderParcel: reportDeliveryFailureForRiderParcelMock,
  resolveFailedParcelByAdmin: resolveFailedParcelByAdminMock,
  startDeliveryForRiderParcels: startDeliveryForRiderParcelsMock,
  updateDeliveryFailureForRiderParcel: updateDeliveryFailureForRiderParcelMock,
  updateParcel: updateParcelMock,
}));

void mock.module("@/features/parcels/server/upload", () => ({
  uploadDeliveryProofImage: uploadDeliveryProofImageMock,
}));

void mock.module("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

describe("parcel server actions", async () => {
  const {
    assignParcelsToRiderAction,
    createParcelAction,
    deleteDeliveryFailureForRiderParcelAction,
    markRiderParcelDeliveredAction,
    markRiderParcelReturnedToMerchantAction,
    postponeFailedParcelAction,
    reportDeliveryFailureForRiderParcelAction,
    returnFailedParcelToMerchantAction,
    updateDeliveryFailureForRiderParcelAction,
    updateParcelAction,
  } = await import("@/features/parcels/server/actions");

  beforeEach(() => {
    requireCurrentUserMock.mockReset();
    createParcelMock.mockReset();
    assignParcelsToRiderMock.mockReset();
    startDeliveryForRiderParcelsMock.mockReset();
    reportDeliveryFailureForRiderParcelMock.mockReset();
    updateDeliveryFailureForRiderParcelMock.mockReset();
    deleteDeliveryFailureForRiderParcelMock.mockReset();
    markRiderParcelDeliveredMock.mockReset();
    markRiderParcelReturnedToMerchantMock.mockReset();
    resolveFailedParcelByAdminMock.mockReset();
    updateParcelMock.mockReset();
    uploadDeliveryProofImageMock.mockReset();
    revalidatePathMock.mockReset();
    requireCurrentUserMock.mockResolvedValue(
      buildCurrentUser({ id: "actor-id", role: "super_admin" }),
    );
    createParcelMock.mockResolvedValue({ id: "parcel-id", parcelCode: "PF-000001-000001" });
    assignParcelsToRiderMock.mockResolvedValue(undefined);
    startDeliveryForRiderParcelsMock.mockResolvedValue(undefined);
    reportDeliveryFailureForRiderParcelMock.mockResolvedValue(undefined);
    updateDeliveryFailureForRiderParcelMock.mockResolvedValue(undefined);
    deleteDeliveryFailureForRiderParcelMock.mockResolvedValue(undefined);
    markRiderParcelDeliveredMock.mockResolvedValue(undefined);
    markRiderParcelReturnedToMerchantMock.mockResolvedValue(undefined);
    resolveFailedParcelByAdminMock.mockResolvedValue(undefined);
    updateParcelMock.mockResolvedValue(undefined);
    uploadDeliveryProofImageMock.mockResolvedValue("parcels/parcel-id/proof-of-delivery/proof.jpg");
  });

  test("rejects invalid parcel creation input before persistence", async () => {
    const result = await createParcelAction({ receiverName: "" });

    expect(result.ok).toBe(false);
    expect(createParcelMock).not.toHaveBeenCalled();
  });

  test("rejects parcel creation from merchant users", async () => {
    requireCurrentUserMock.mockResolvedValue(buildCurrentUser({ role: "merchant" }));

    const result = await createParcelAction(validParcelInput());

    expect(result).toEqual({
      ok: false,
      message: "You do not have permission to create parcels.",
    });
    expect(createParcelMock).not.toHaveBeenCalled();
  });

  test("creates parcels with the current actor as creator", async () => {
    const result = await createParcelAction(validParcelInput());

    expect(result.ok).toBe(true);
    expect(createParcelMock).toHaveBeenCalledWith({
      merchantId: "merchant-id",
      receiverName: "Receiver",
      receiverPhoneNumber: "09123456789",
      receiverAddress: "Address",
      townshipId: "township-id",
      parcelType: "cod",
      codAmount: 10_000,
      deliveryFee: 2_000,
      weightKg: 3,
      isLargeParcel: false,
      createdBy: "actor-id",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/parcels");
  });

  test("updates parcels and revalidates affected read models", async () => {
    requireCurrentUserMock.mockResolvedValue(buildCurrentUser({ id: "admin-id", role: "office_admin" }));

    const result = await updateParcelAction({
      id: "00000000-0000-4000-8000-000000000001",
      merchantId: "merchant-id",
      receiverName: "Receiver",
      receiverPhoneNumber: "09123456789",
      receiverAddress: "Address",
      specialNotes: "",
      townshipId: "township-id",
      deliveryFee: "2000",
      hasCod: true,
      codAmount: "10000",
      dimensions: {
        estimatedWeight: "3",
        width: "",
        height: "",
        length: "",
      },
    });

    expect(result).toEqual({
      ok: true,
      message: "Parcel updated.",
    });
    expect(updateParcelMock).toHaveBeenCalledWith({
      id: "00000000-0000-4000-8000-000000000001",
      merchantId: "merchant-id",
      receiverName: "Receiver",
      receiverPhoneNumber: "09123456789",
      receiverAddress: "Address",
      townshipId: "township-id",
      parcelType: "cod",
      codAmount: 10000,
      deliveryFee: 2000,
      weightKg: 3,
      isLargeParcel: false,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/parcels");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/merchant/parcels");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/rider/parcels");
  });

  test("rejects invalid rider assignment input before persistence", async () => {
    const result = await assignParcelsToRiderAction({ riderId: "", parcelIds: [] });

    expect(result.ok).toBe(false);
    expect(assignParcelsToRiderMock).not.toHaveBeenCalled();
  });

  test("rejects rider assignment from rider users", async () => {
    requireCurrentUserMock.mockResolvedValue(buildCurrentUser({ role: "rider" }));

    const result = await assignParcelsToRiderAction({
      riderId: "rider-id",
      parcelIds: ["parcel-id"],
    });

    expect(result).toEqual({
      ok: false,
      message: "You do not have permission to assign parcels.",
    });
    expect(assignParcelsToRiderMock).not.toHaveBeenCalled();
  });

  test("assigns parcels and revalidates affected read models", async () => {
    const result = await assignParcelsToRiderAction({
      riderId: "rider-id",
      parcelIds: ["parcel-id"],
    });

    expect(result).toEqual({
      ok: true,
      message: "Parcels assigned.",
    });
    expect(assignParcelsToRiderMock).toHaveBeenCalledWith({
      riderId: "rider-id",
      parcelIds: ["parcel-id"],
      actorId: "actor-id",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/parcels");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/riders");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/rider/parcels");
  });

  test("returns DAL assignment errors to the caller", async () => {
    assignParcelsToRiderMock.mockRejectedValue(
      new Error("Only unassigned at-office, postponed, or returned parcels can be assigned."),
    );

    const result = await assignParcelsToRiderAction({
      riderId: "rider-id",
      parcelIds: ["parcel-id"],
    });

    expect(result).toEqual({
      ok: false,
      message: "Only unassigned at-office, postponed, or returned parcels can be assigned.",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  test("postpones failed parcels and revalidates affected read models", async () => {
    const result = await postponeFailedParcelAction({
      parcelId: "00000000-0000-4000-8000-000000000001",
    });

    expect(result).toEqual({
      ok: true,
      message: "Parcel postponed for retry.",
    });
    expect(resolveFailedParcelByAdminMock).toHaveBeenCalledWith({
      parcelId: "00000000-0000-4000-8000-000000000001",
      targetStatus: "postpone",
      actorId: "actor-id",
      actorRole: "super_admin",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/parcels");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/riders");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/rider/parcels");
  });

  test("marks failed parcels for merchant return and revalidates affected read models", async () => {
    requireCurrentUserMock.mockResolvedValue(buildCurrentUser({ id: "admin-id", role: "office_admin" }));

    const result = await returnFailedParcelToMerchantAction({
      parcelId: "00000000-0000-4000-8000-000000000001",
    });

    expect(result).toEqual({
      ok: true,
      message: "Parcel marked for merchant return.",
    });
    expect(resolveFailedParcelByAdminMock).toHaveBeenCalledWith({
      parcelId: "00000000-0000-4000-8000-000000000001",
      targetStatus: "canceled_returned",
      actorId: "admin-id",
      actorRole: "office_admin",
    });
  });

  test("rejects invalid failed parcel resolution input before persistence", async () => {
    const result = await postponeFailedParcelAction({ parcelId: "" });

    expect(result.ok).toBe(false);
    expect(resolveFailedParcelByAdminMock).not.toHaveBeenCalled();
  });

  test("rejects failed parcel resolution from non-admin users", async () => {
    requireCurrentUserMock.mockResolvedValue(buildCurrentUser({ role: "rider" }));

    const result = await returnFailedParcelToMerchantAction({
      parcelId: "00000000-0000-4000-8000-000000000001",
    });

    expect(result).toEqual({
      ok: false,
      message: "You do not have permission to resolve failed parcels.",
    });
    expect(resolveFailedParcelByAdminMock).not.toHaveBeenCalled();
  });

  test("returns stale failed parcel resolution errors to the caller", async () => {
    resolveFailedParcelByAdminMock.mockRejectedValue(new Error("This failure report has already been handled."));

    const result = await postponeFailedParcelAction({
      parcelId: "00000000-0000-4000-8000-000000000001",
    });

    expect(result).toEqual({
      ok: false,
      message: "This failure report has already been handled.",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  test("reports rider delivery failure and revalidates affected read models", async () => {
    requireCurrentUserMock.mockResolvedValue(
      buildCurrentUser({ id: "rider-user-id", role: "rider" }),
    );

    const result = await reportDeliveryFailureForRiderParcelAction({
      parcelId: "00000000-0000-4000-8000-000000000001",
      note: "Receiver was not available.",
    });

    expect(result).toEqual({
      ok: true,
      message: "Delivery failure reported.",
    });
    expect(reportDeliveryFailureForRiderParcelMock).toHaveBeenCalledWith({
      parcelId: "00000000-0000-4000-8000-000000000001",
      note: "Receiver was not available.",
      riderUserId: "rider-user-id",
      actorRole: "rider",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/rider/parcels");
  });

  test("rejects invalid delivery failure reports before persistence", async () => {
    requireCurrentUserMock.mockResolvedValue(
      buildCurrentUser({ id: "rider-user-id", role: "rider" }),
    );

    const result = await reportDeliveryFailureForRiderParcelAction({
      parcelId: "00000000-0000-4000-8000-000000000001",
      note: "",
    });

    expect(result.ok).toBe(false);
    expect(reportDeliveryFailureForRiderParcelMock).not.toHaveBeenCalled();
  });

  test("updates rider delivery failure notes and revalidates affected read models", async () => {
    requireCurrentUserMock.mockResolvedValue(
      buildCurrentUser({ id: "rider-user-id", role: "rider" }),
    );

    const result = await updateDeliveryFailureForRiderParcelAction({
      parcelId: "00000000-0000-4000-8000-000000000001",
      note: "Please call before delivery.",
    });

    expect(result).toEqual({
      ok: true,
      message: "Delivery failure note updated.",
    });
    expect(updateDeliveryFailureForRiderParcelMock).toHaveBeenCalledWith({
      parcelId: "00000000-0000-4000-8000-000000000001",
      note: "Please call before delivery.",
      riderUserId: "rider-user-id",
      actorRole: "rider",
    });
  });

  test("rejects delivery failure reports from non-rider users", async () => {
    requireCurrentUserMock.mockResolvedValue(buildCurrentUser({ role: "office_admin" }));

    const result = await reportDeliveryFailureForRiderParcelAction({
      parcelId: "00000000-0000-4000-8000-000000000001",
      note: "Receiver was not available.",
    });

    expect(result).toEqual({
      ok: false,
      message: "You do not have permission to report delivery failure.",
    });
    expect(reportDeliveryFailureForRiderParcelMock).not.toHaveBeenCalled();
  });

  test("deletes rider delivery failure notes and revalidates affected read models", async () => {
    requireCurrentUserMock.mockResolvedValue(
      buildCurrentUser({ id: "rider-user-id", role: "rider" }),
    );

    const result = await deleteDeliveryFailureForRiderParcelAction({
      parcelId: "00000000-0000-4000-8000-000000000001",
    });

    expect(result).toEqual({
      ok: true,
      message: "Delivery failure note deleted.",
    });
    expect(deleteDeliveryFailureForRiderParcelMock).toHaveBeenCalledWith({
      parcelId: "00000000-0000-4000-8000-000000000001",
      riderUserId: "rider-user-id",
      actorRole: "rider",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/rider/parcels");
  });

  test("rejects delivery failure note deletion from non-rider users", async () => {
    requireCurrentUserMock.mockResolvedValue(buildCurrentUser({ role: "office_admin" }));

    const result = await deleteDeliveryFailureForRiderParcelAction({
      parcelId: "00000000-0000-4000-8000-000000000001",
    });

    expect(result).toEqual({
      ok: false,
      message: "You do not have permission to delete delivery failure notes.",
    });
    expect(deleteDeliveryFailureForRiderParcelMock).not.toHaveBeenCalled();
  });

  test("marks rider parcel delivered with uploaded proof key", async () => {
    requireCurrentUserMock.mockResolvedValue(
      buildCurrentUser({ id: "rider-user-id", role: "rider" }),
    );
    const formData = new FormData();
    const proofImage = new File(["proof"], "proof.jpg", { type: "image/jpeg" });
    formData.set("parcelId", "00000000-0000-4000-8000-000000000001");
    formData.set("proofImage", proofImage);

    const result = await markRiderParcelDeliveredAction(formData);

    expect(result).toEqual({
      ok: true,
      message: "Parcel marked delivered.",
    });
    expect(uploadDeliveryProofImageMock).toHaveBeenCalledWith({
      parcelId: "00000000-0000-4000-8000-000000000001",
      file: proofImage,
    });
    expect(markRiderParcelDeliveredMock).toHaveBeenCalledWith({
      parcelId: "00000000-0000-4000-8000-000000000001",
      proofImageKey: "parcels/parcel-id/proof-of-delivery/proof.jpg",
      riderUserId: "rider-user-id",
      actorRole: "rider",
      createdBy: "rider-user-id",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/rider/parcels");
  });

  test("rejects mark delivered without proof before upload", async () => {
    requireCurrentUserMock.mockResolvedValue(
      buildCurrentUser({ id: "rider-user-id", role: "rider" }),
    );
    const formData = new FormData();
    formData.set("parcelId", "00000000-0000-4000-8000-000000000001");

    const result = await markRiderParcelDeliveredAction(formData);

    expect(result).toEqual({
      ok: false,
      message: "Delivery proof photo is required.",
    });
    expect(uploadDeliveryProofImageMock).not.toHaveBeenCalled();
    expect(markRiderParcelDeliveredMock).not.toHaveBeenCalled();
  });

  test("rejects mark delivered with invalid proof before upload", async () => {
    requireCurrentUserMock.mockResolvedValue(
      buildCurrentUser({ id: "rider-user-id", role: "rider" }),
    );
    const formData = new FormData();
    formData.set("parcelId", "00000000-0000-4000-8000-000000000001");
    formData.set("proofImage", new File(["not image"], "proof.txt", { type: "text/plain" }));

    const result = await markRiderParcelDeliveredAction(formData);

    expect(result).toEqual({
      ok: false,
      message: "Delivery proof photo must be a JPG, PNG, or WebP image.",
    });
    expect(uploadDeliveryProofImageMock).not.toHaveBeenCalled();
    expect(markRiderParcelDeliveredMock).not.toHaveBeenCalled();
  });

  test("rejects mark delivered from non-rider users", async () => {
    requireCurrentUserMock.mockResolvedValue(buildCurrentUser({ role: "merchant" }));
    const formData = new FormData();
    formData.set("parcelId", "00000000-0000-4000-8000-000000000001");
    formData.set("proofImage", new File(["proof"], "proof.jpg", { type: "image/jpeg" }));

    const result = await markRiderParcelDeliveredAction(formData);

    expect(result).toEqual({
      ok: false,
      message: "You do not have permission to mark parcels delivered.",
    });
    expect(uploadDeliveryProofImageMock).not.toHaveBeenCalled();
    expect(markRiderParcelDeliveredMock).not.toHaveBeenCalled();
  });

  test("marks canceled-returned parcel as returned to merchant", async () => {
    requireCurrentUserMock.mockResolvedValue(
      buildCurrentUser({ id: "rider-user-id", role: "rider" }),
    );

    const result = await markRiderParcelReturnedToMerchantAction({
      parcelId: "00000000-0000-4000-8000-000000000001",
    });

    expect(result).toEqual({
      ok: true,
      message: "Parcel returned to merchant.",
    });
    expect(markRiderParcelReturnedToMerchantMock).toHaveBeenCalledWith({
      parcelId: "00000000-0000-4000-8000-000000000001",
      riderUserId: "rider-user-id",
      actorRole: "rider",
      createdBy: "rider-user-id",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/rider/parcels");
  });

  test("rejects return completion from non-rider users", async () => {
    requireCurrentUserMock.mockResolvedValue(buildCurrentUser({ role: "office_admin" }));

    const result = await markRiderParcelReturnedToMerchantAction({
      parcelId: "00000000-0000-4000-8000-000000000001",
    });

    expect(result).toEqual({
      ok: false,
      message: "You do not have permission to complete parcel returns.",
    });
    expect(markRiderParcelReturnedToMerchantMock).not.toHaveBeenCalled();
  });
});

function validParcelInput() {
  return {
    merchantId: "merchant-id",
    receiverName: "Receiver",
    receiverPhoneNumber: "09123456789",
    receiverAddress: "Address",
    specialNotes: "",
    townshipId: "township-id",
    parcelType: "cod",
    codAmount: "10000",
    deliveryFee: "2000",
    hasCod: true,
    dimensions: {
      estimatedWeight: "3",
      width: "",
      height: "",
      length: "",
    },
  };
}
