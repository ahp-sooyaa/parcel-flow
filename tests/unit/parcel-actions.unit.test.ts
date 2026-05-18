import { beforeEach, describe, expect, mock, test } from "bun:test";

import { buildCurrentUser } from "../fixtures/builders";

const requireCurrentUserMock = mock(async () => buildCurrentUser({ role: "super_admin" }));
const createParcelMock = mock(async () => ({ id: "parcel-id", parcelCode: "PF-000001-000001" }));
const assignParcelsToRiderMock = mock(async () => undefined);
const revalidatePathMock = mock(() => undefined);

void mock.module("@/lib/session", () => ({
  requireCurrentUser: requireCurrentUserMock,
}));

void mock.module("@/features/parcels/server/dal", () => ({
  assignParcelsToRider: assignParcelsToRiderMock,
  createParcel: createParcelMock,
}));

void mock.module("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

describe("parcel server actions", async () => {
  const { assignParcelsToRiderAction, createParcelAction } = await import(
    "@/features/parcels/server/actions"
  );

  beforeEach(() => {
    requireCurrentUserMock.mockReset();
    createParcelMock.mockReset();
    assignParcelsToRiderMock.mockReset();
    revalidatePathMock.mockReset();
    requireCurrentUserMock.mockResolvedValue(buildCurrentUser({ id: "actor-id", role: "super_admin" }));
    createParcelMock.mockResolvedValue({ id: "parcel-id", parcelCode: "PF-000001-000001" });
    assignParcelsToRiderMock.mockResolvedValue(undefined);
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
