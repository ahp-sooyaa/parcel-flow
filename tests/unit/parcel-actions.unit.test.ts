import { beforeEach, describe, expect, mock, test } from "bun:test";

import { buildSessionUser } from "../fixtures/builders";

const getSessionMock = mock(async () => buildSessionUser({ role: "super_admin" }));
const headersMock = mock(async () => new Headers());
const createParcelMock = mock(async () => ({ id: "parcel-id", parcelCode: "PF-000001-000001" }));
const assignParcelsToRiderMock = mock(async () => undefined);
const correctParcelStatusMock = mock(async () => undefined);
const correctParcelRiderMock = mock(async () => undefined);
const startDeliveryForRiderParcelsMock = mock(async () => undefined);
const reportDeliveryFailureForRiderParcelMock = mock(async () => undefined);
const updateDeliveryFailureForRiderParcelMock = mock(async () => undefined);
const deleteDeliveryFailureForRiderParcelMock = mock(async () => undefined);
const markRiderParcelReturnedToMerchantMock = mock(async () => undefined);
const resolveFailedParcelByAdminMock = mock(async () => undefined);
const updateParcelMock = mock(async () => undefined);
const getParcelByIdForRealtimeScopeMock = mock(async () => null);
const uploadDeliveryProofImageMock = mock(async () => "parcels/test/proof.jpg");
const deleteDeliveryProofImageMock = mock(async () => undefined);
const revalidatePathMock = mock(() => undefined);
const updateTagMock = mock(() => undefined);
const revalidateTagMock = mock(() => undefined);

void mock.module("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

void mock.module("next/headers", () => ({
  headers: headersMock,
}));

// Bun keeps module mocks for later test files, so keep the real DAL exports.
const actualParcelsDal = await import("@/features/parcels/server/dal");

void mock.module("@/features/parcels/server/dal", () => ({
  ...actualParcelsDal,
  assignParcelsToRider: assignParcelsToRiderMock,
  correctParcelRider: correctParcelRiderMock,
  correctParcelStatus: correctParcelStatusMock,
  createParcel: createParcelMock,
  deleteDeliveryFailureForRiderParcel: deleteDeliveryFailureForRiderParcelMock,
  markRiderParcelReturnedToMerchant: markRiderParcelReturnedToMerchantMock,
  reportDeliveryFailureForRiderParcel: reportDeliveryFailureForRiderParcelMock,
  resolveFailedParcelByAdmin: resolveFailedParcelByAdminMock,
  startDeliveryForRiderParcels: startDeliveryForRiderParcelsMock,
  updateDeliveryFailureForRiderParcel: updateDeliveryFailureForRiderParcelMock,
  updateParcel: updateParcelMock,
  getParcelByIdForRealtimeScope: getParcelByIdForRealtimeScopeMock,
}));

void mock.module("@/features/parcels/server/upload", () => ({
  deleteDeliveryProofImage: deleteDeliveryProofImageMock,
  uploadDeliveryProofImage: uploadDeliveryProofImageMock,
}));

void mock.module("next/cache", () => ({
  cacheLife: () => undefined,
  cacheTag: () => undefined,
  revalidatePath: revalidatePathMock,
  updateTag: updateTagMock,
  revalidateTag: revalidateTagMock,
}));

describe("parcel server actions", async () => {
  const {
    assignParcelsToRiderAction,
    correctParcelRiderAction,
    correctParcelStatusAction,
    createParcelAction,
    deleteDeliveryFailureForRiderParcelAction,
    markRiderParcelReturnedToMerchantAction,
    postponeFailedParcelAction,
    reportDeliveryFailureForRiderParcelAction,
    returnFailedParcelToMerchantAction,
    startDeliveryForRiderParcelsAction,
    updateDeliveryFailureForRiderParcelAction,
    updateParcelAction,
  } = await import("@/features/parcels/server/actions");

  beforeEach(() => {
    getSessionMock.mockReset();
    headersMock.mockReset();
    createParcelMock.mockReset();
    assignParcelsToRiderMock.mockReset();
    correctParcelStatusMock.mockReset();
    correctParcelRiderMock.mockReset();
    startDeliveryForRiderParcelsMock.mockReset();
    reportDeliveryFailureForRiderParcelMock.mockReset();
    updateDeliveryFailureForRiderParcelMock.mockReset();
    deleteDeliveryFailureForRiderParcelMock.mockReset();
    markRiderParcelReturnedToMerchantMock.mockReset();
    resolveFailedParcelByAdminMock.mockReset();
    updateParcelMock.mockReset();
    uploadDeliveryProofImageMock.mockReset();
    deleteDeliveryProofImageMock.mockReset();
    revalidatePathMock.mockReset();
    updateTagMock.mockReset();
    revalidateTagMock.mockReset();
    getSessionMock.mockResolvedValue(buildSessionUser({ id: "actor-id", role: "super_admin" }));
    headersMock.mockResolvedValue(new Headers());
    createParcelMock.mockResolvedValue({ id: "parcel-id", parcelCode: "PF-000001-000001" });
    assignParcelsToRiderMock.mockResolvedValue(undefined);
    correctParcelStatusMock.mockResolvedValue(undefined);
    correctParcelRiderMock.mockResolvedValue(undefined);
    startDeliveryForRiderParcelsMock.mockResolvedValue(undefined);
    reportDeliveryFailureForRiderParcelMock.mockResolvedValue(undefined);
    updateDeliveryFailureForRiderParcelMock.mockResolvedValue(undefined);
    deleteDeliveryFailureForRiderParcelMock.mockResolvedValue(undefined);
    markRiderParcelReturnedToMerchantMock.mockResolvedValue(undefined);
    resolveFailedParcelByAdminMock.mockResolvedValue(undefined);
    updateParcelMock.mockResolvedValue(undefined);
    uploadDeliveryProofImageMock.mockResolvedValue("parcels/test/proof.jpg");
    deleteDeliveryProofImageMock.mockResolvedValue(undefined);
  });

  test("rejects invalid parcel creation input before persistence", async () => {
    const result = await createParcelAction({ receiverName: "" });

    expect(result.ok).toBe(false);
    expect(createParcelMock).not.toHaveBeenCalled();
  });

  test("rejects parcel creation from merchant users", async () => {
    getSessionMock.mockResolvedValue(buildSessionUser({ role: "merchant" }));

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
    getSessionMock.mockResolvedValue(buildSessionUser({ id: "admin-id", role: "office_admin" }));

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
    getSessionMock.mockResolvedValue(buildSessionUser({ role: "rider" }));

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

  test("corrects parcel status and revalidates affected read models", async () => {
    const result = await correctParcelStatusAction({
      parcelId: "00000000-0000-4000-8000-000000000001",
      expectedStatus: "at_office",
      expectedRiderId: null,
      expectedFinancialItemsFingerprint: "state-token",
      targetStatus: "on_the_way",
      targetRiderId: "00000000-0000-4000-8000-000000000002",
      reason: "Wrong status selected.",
    });

    expect(result).toEqual({
      ok: true,
      message: "Parcel status corrected.",
    });
    expect(correctParcelStatusMock).toHaveBeenCalledWith({
      parcelId: "00000000-0000-4000-8000-000000000001",
      expectedStatus: "at_office",
      expectedRiderId: null,
      expectedFinancialItemsFingerprint: "state-token",
      targetStatus: "on_the_way",
      targetRiderId: "00000000-0000-4000-8000-000000000002",
      proofImageKey: undefined,
      reason: "Wrong status selected.",
      actorId: "actor-id",
      actorRole: "super_admin",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/parcels");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/settlements");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/rider-payouts");
  });

  test("uploads delivered correction proof image before correcting status", async () => {
    const formData = new FormData();
    const proofImage = new File(["proof"], "proof.jpg", { type: "image/jpeg" });
    formData.set("parcelId", "00000000-0000-4000-8000-000000000001");
    formData.set("expectedStatus", "on_the_way");
    formData.set("expectedRiderId", "00000000-0000-4000-8000-000000000002");
    formData.set("expectedFinancialItemsFingerprint", "state-token");
    formData.set("targetStatus", "delivered");
    formData.set("targetRiderId", "00000000-0000-4000-8000-000000000002");
    formData.set("reason", "Delivered status was missed.");
    formData.set("proofImage", proofImage);

    const result = await correctParcelStatusAction(formData);

    expect(result).toEqual({
      ok: true,
      message: "Parcel status corrected.",
    });
    expect(uploadDeliveryProofImageMock).toHaveBeenCalledWith({
      parcelId: "00000000-0000-4000-8000-000000000001",
      file: proofImage,
    });
    expect(correctParcelStatusMock).toHaveBeenCalledWith({
      parcelId: "00000000-0000-4000-8000-000000000001",
      expectedStatus: "on_the_way",
      expectedRiderId: "00000000-0000-4000-8000-000000000002",
      expectedFinancialItemsFingerprint: "state-token",
      targetStatus: "delivered",
      targetRiderId: "00000000-0000-4000-8000-000000000002",
      proofImageKey: "parcels/test/proof.jpg",
      reason: "Delivered status was missed.",
      actorId: "actor-id",
      actorRole: "super_admin",
    });
    expect(deleteDeliveryProofImageMock).not.toHaveBeenCalled();
  });

  test("ignores proof images submitted for non-delivered status corrections", async () => {
    const formData = new FormData();
    const proofImage = new File(["proof"], "proof.jpg", { type: "image/jpeg" });
    formData.set("parcelId", "00000000-0000-4000-8000-000000000001");
    formData.set("expectedStatus", "on_the_way");
    formData.set("expectedRiderId", "00000000-0000-4000-8000-000000000002");
    formData.set("expectedFinancialItemsFingerprint", "state-token");
    formData.set("targetStatus", "at_office");
    formData.set("targetRiderId", "");
    formData.set("reason", "Delivered proof was submitted with the wrong target.");
    formData.set("proofImage", proofImage);

    const result = await correctParcelStatusAction(formData);

    expect(result).toEqual({
      ok: true,
      message: "Parcel status corrected.",
    });
    expect(uploadDeliveryProofImageMock).not.toHaveBeenCalled();
    expect(deleteDeliveryProofImageMock).not.toHaveBeenCalled();
    expect(correctParcelStatusMock).toHaveBeenCalledWith({
      parcelId: "00000000-0000-4000-8000-000000000001",
      expectedStatus: "on_the_way",
      expectedRiderId: "00000000-0000-4000-8000-000000000002",
      expectedFinancialItemsFingerprint: "state-token",
      targetStatus: "at_office",
      targetRiderId: null,
      proofImageKey: undefined,
      reason: "Delivered proof was submitted with the wrong target.",
      actorId: "actor-id",
      actorRole: "super_admin",
    });
  });

  test("deletes uploaded delivered correction proof when persistence rejects", async () => {
    correctParcelStatusMock.mockRejectedValue(
      new Error("Parcel changed since you opened it. Refresh and review before correcting."),
    );
    const formData = new FormData();
    const proofImage = new File(["proof"], "proof.jpg", { type: "image/jpeg" });
    formData.set("parcelId", "00000000-0000-4000-8000-000000000001");
    formData.set("expectedStatus", "on_the_way");
    formData.set("expectedRiderId", "00000000-0000-4000-8000-000000000002");
    formData.set("expectedFinancialItemsFingerprint", "state-token");
    formData.set("targetStatus", "delivered");
    formData.set("targetRiderId", "00000000-0000-4000-8000-000000000002");
    formData.set("reason", "Delivered status was missed.");
    formData.set("proofImage", proofImage);

    const result = await correctParcelStatusAction(formData);

    expect(result).toEqual({
      ok: false,
      message: "Parcel changed since you opened it. Refresh and review before correcting.",
    });
    expect(deleteDeliveryProofImageMock).toHaveBeenCalledWith("parcels/test/proof.jpg");
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  test("rejects invalid parcel status corrections before persistence", async () => {
    const result = await correctParcelStatusAction({
      parcelId: "00000000-0000-4000-8000-000000000001",
      expectedStatus: "on_the_way",
      expectedRiderId: "00000000-0000-4000-8000-000000000002",
      expectedFinancialItemsFingerprint: "state-token",
      targetStatus: "delivered",
      reason: "",
    });

    expect(result.ok).toBe(false);
    expect(correctParcelStatusMock).not.toHaveBeenCalled();
  });

  test("rejects parcel corrections from merchant users", async () => {
    getSessionMock.mockResolvedValue(buildSessionUser({ role: "merchant" }));

    const result = await correctParcelRiderAction({
      parcelId: "00000000-0000-4000-8000-000000000001",
      expectedStatus: "at_office",
      expectedRiderId: "00000000-0000-4000-8000-000000000002",
      expectedFinancialItemsFingerprint: "state-token",
      targetRiderId: null,
      reason: "Wrong rider selected.",
    });

    expect(result).toEqual({
      ok: false,
      message: "You do not have permission to correct parcels.",
    });
    expect(correctParcelRiderMock).not.toHaveBeenCalled();
  });

  test("corrects parcel rider and returns DAL errors", async () => {
    correctParcelRiderMock.mockRejectedValue(
      new Error("This parcel status requires an active rider assignment."),
    );

    const result = await correctParcelRiderAction({
      parcelId: "00000000-0000-4000-8000-000000000001",
      expectedStatus: "on_the_way",
      expectedRiderId: "00000000-0000-4000-8000-000000000002",
      expectedFinancialItemsFingerprint: "state-token",
      targetRiderId: null,
      reason: "Wrong rider selected.",
    });

    expect(result).toEqual({
      ok: false,
      message: "This parcel status requires an active rider assignment.",
    });
    expect(correctParcelRiderMock).toHaveBeenCalledWith({
      parcelId: "00000000-0000-4000-8000-000000000001",
      expectedStatus: "on_the_way",
      expectedRiderId: "00000000-0000-4000-8000-000000000002",
      expectedFinancialItemsFingerprint: "state-token",
      targetRiderId: null,
      reason: "Wrong rider selected.",
      actorId: "actor-id",
      actorRole: "super_admin",
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
    getSessionMock.mockResolvedValue(buildSessionUser({ id: "admin-id", role: "office_admin" }));

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
    getSessionMock.mockResolvedValue(buildSessionUser({ role: "rider" }));

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
    resolveFailedParcelByAdminMock.mockRejectedValue(
      new Error("This failure report has already been handled."),
    );

    const result = await postponeFailedParcelAction({
      parcelId: "00000000-0000-4000-8000-000000000001",
    });

    expect(result).toEqual({
      ok: false,
      message: "This failure report has already been handled.",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  test("starts delivery for one rider parcel and revalidates affected read models", async () => {
    getSessionMock.mockResolvedValue(buildSessionUser({ id: "rider-user-id", role: "rider" }));

    const result = await startDeliveryForRiderParcelsAction({
      parcelIds: ["00000000-0000-4000-8000-000000000001"],
    });

    expect(result).toEqual({ ok: true, message: "Parcel moved to on the way." });
    expect(startDeliveryForRiderParcelsMock).toHaveBeenCalledWith({
      parcelIds: ["00000000-0000-4000-8000-000000000001"],
      riderUserId: "rider-user-id",
      actorRole: "rider",
    });
    // Server Actions read their own writes through updateTag, not stale-while-revalidate.
    expect(updateTagMock).toHaveBeenCalledWith("rider-parcels:rider-user-id");
    expect(revalidateTagMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/rider/parcels");
  });

  test("starts delivery for several rider parcels", async () => {
    getSessionMock.mockResolvedValue(buildSessionUser({ id: "rider-user-id", role: "rider" }));

    const result = await startDeliveryForRiderParcelsAction({
      parcelIds: ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"],
    });

    expect(result).toEqual({ ok: true, message: "Selected parcels moved to on the way." });
  });

  test("rejects invalid start delivery input before persistence", async () => {
    getSessionMock.mockResolvedValue(buildSessionUser({ id: "rider-user-id", role: "rider" }));

    expect(await startDeliveryForRiderParcelsAction({ parcelIds: [] })).toEqual({
      ok: false,
      message: "Select at least one parcel.",
    });
    expect(await startDeliveryForRiderParcelsAction({ parcelIds: ["not-a-uuid"] })).toEqual({
      ok: false,
      message: "Invalid parcel selection.",
    });
    expect(startDeliveryForRiderParcelsMock).not.toHaveBeenCalled();
  });

  test("rejects start delivery from non-rider users", async () => {
    const result = await startDeliveryForRiderParcelsAction({
      parcelIds: ["00000000-0000-4000-8000-000000000001"],
    });

    expect(result).toEqual({
      ok: false,
      message: "You do not have permission to start delivery.",
    });
    expect(startDeliveryForRiderParcelsMock).not.toHaveBeenCalled();
  });

  test("returns DAL start delivery errors to the caller", async () => {
    getSessionMock.mockResolvedValue(buildSessionUser({ id: "rider-user-id", role: "rider" }));
    startDeliveryForRiderParcelsMock.mockRejectedValue(
      new Error("Only assigned at-office parcels can be started for delivery."),
    );

    const result = await startDeliveryForRiderParcelsAction({
      parcelIds: ["00000000-0000-4000-8000-000000000001"],
    });

    expect(result).toEqual({
      ok: false,
      message: "Only assigned at-office parcels can be started for delivery.",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  test("reports rider delivery failure and revalidates affected read models", async () => {
    getSessionMock.mockResolvedValue(buildSessionUser({ id: "rider-user-id", role: "rider" }));

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
    getSessionMock.mockResolvedValue(buildSessionUser({ id: "rider-user-id", role: "rider" }));

    const result = await reportDeliveryFailureForRiderParcelAction({
      parcelId: "00000000-0000-4000-8000-000000000001",
      note: "",
    });

    expect(result.ok).toBe(false);
    expect(reportDeliveryFailureForRiderParcelMock).not.toHaveBeenCalled();
  });

  test("updates rider delivery failure notes and revalidates affected read models", async () => {
    getSessionMock.mockResolvedValue(buildSessionUser({ id: "rider-user-id", role: "rider" }));

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
    getSessionMock.mockResolvedValue(buildSessionUser({ role: "office_admin" }));

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
    getSessionMock.mockResolvedValue(buildSessionUser({ id: "rider-user-id", role: "rider" }));

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
    getSessionMock.mockResolvedValue(buildSessionUser({ role: "office_admin" }));

    const result = await deleteDeliveryFailureForRiderParcelAction({
      parcelId: "00000000-0000-4000-8000-000000000001",
    });

    expect(result).toEqual({
      ok: false,
      message: "You do not have permission to delete delivery failure notes.",
    });
    expect(deleteDeliveryFailureForRiderParcelMock).not.toHaveBeenCalled();
  });

  test("marks canceled-returned parcel as returned to merchant", async () => {
    getSessionMock.mockResolvedValue(buildSessionUser({ id: "rider-user-id", role: "rider" }));

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
    getSessionMock.mockResolvedValue(buildSessionUser({ role: "office_admin" }));

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
