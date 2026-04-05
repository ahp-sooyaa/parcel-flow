import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const findMerchantByAppUserIdMock = vi.hoisted(() => vi.fn());
const getRiderByIdMock = vi.hoisted(() => vi.fn());
const findTownshipByIdMock = vi.hoisted(() => vi.fn());
const createParcelWithPaymentAndAuditMock = vi.hoisted(() => vi.fn());
const getParcelUpdateContextMock = vi.hoisted(() => vi.fn());
const isParcelCodeInUseMock = vi.hoisted(() => vi.fn());
const updateParcelAndPaymentWithAuditMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/features/auth/server/utils", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/features/merchant/server/dal", () => ({
  findMerchantByAppUserId: findMerchantByAppUserIdMock,
}));

vi.mock("@/features/rider/server/dal", () => ({
  getRiderById: getRiderByIdMock,
}));

vi.mock("@/features/townships/server/dal", () => ({
  findTownshipById: findTownshipByIdMock,
}));

vi.mock("@/features/parcels/server/dal", async () => {
  const actual = await vi.importActual<typeof import("@/features/parcels/server/dal")>(
    "@/features/parcels/server/dal",
  );

  return {
    ...actual,
    createParcelWithPaymentAndAudit: createParcelWithPaymentAndAuditMock,
    getParcelUpdateContext: getParcelUpdateContextMock,
    isParcelCodeInUse: isParcelCodeInUseMock,
    updateParcelAndPaymentWithAudit: updateParcelAndPaymentWithAuditMock,
  };
});

describe("parcels actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid create payload before writing", async () => {
    requirePermissionMock.mockResolvedValue({
      appUserId: "admin-1",
      role: { slug: "super_admin" },
      permissions: ["parcel.create"],
    });

    const { createParcelAction } = await import("@/features/parcels/server/actions");
    const formData = new FormData();
    formData.set("parcelCode", "A");

    const result = await createParcelAction({ ok: true, message: "" }, formData);

    expect(result).toMatchObject({
      ok: false,
      message: "Please provide valid parcel and payment details.",
    });
    expect(result.fields).toBeDefined();
    expect(createParcelWithPaymentAndAuditMock).not.toHaveBeenCalled();
  });

  it("creates parcel with selected fee payer and delivery fee status", async () => {
    requirePermissionMock.mockResolvedValue({
      appUserId: "admin-1",
      role: { slug: "office_admin" },
      permissions: ["parcel.create"],
    });
    findMerchantByAppUserIdMock.mockResolvedValue({ id: "merchant-1" });
    getRiderByIdMock.mockResolvedValue({ id: "rider-1", isActive: true });
    findTownshipByIdMock.mockResolvedValue({ id: "township-1", isActive: true });
    isParcelCodeInUseMock.mockResolvedValue(false);
    createParcelWithPaymentAndAuditMock.mockResolvedValue({ parcelId: "parcel-1" });

    const { createParcelAction } = await import("@/features/parcels/server/actions");
    const formData = new FormData();
    formData.set("merchantId", "7f048ecf-7989-4f2e-b0a2-97f950f53ea4");
    formData.set("riderId", "5f0ee80f-ad8d-40ce-8ded-d6fffe44f633");
    formData.set("recipientName", "Ko Aung");
    formData.set("recipientPhone", "0912345678");
    formData.set("recipientTownshipId", "c4e4c8c7-a43b-4c56-8913-8c98ebebc35f");
    formData.set("recipientAddress", "No 1, Street");
    formData.set("parcelType", "cod");
    formData.set("codAmount", "12000");
    formData.set("deliveryFee", "1500");
    formData.set("deliveryFeePayer", "merchant");
    formData.set("deliveryFeeStatus", "deduct_from_settlement");
    formData.set("paymentNote", "Handle with care");

    const result = await createParcelAction({ ok: true, message: "" }, formData);

    expect(result).toEqual({
      ok: true,
      message: "Parcel created successfully.",
      parcelId: "parcel-1",
    });
    expect(createParcelWithPaymentAndAuditMock).toHaveBeenCalledTimes(1);
    const callArg = createParcelWithPaymentAndAuditMock.mock.calls[0][0];
    expect(callArg.parcelValues.parcelCode).toMatch(/^PF-\d{6}-\d{6}$/);
    expect(callArg.parcelValues.status).toBe("pending");
    expect(callArg.parcelValues.deliveryFeePayer).toBe("merchant");
    expect(callArg.paymentValues.deliveryFeeStatus).toBe("deduct_from_settlement");
    expect(callArg.paymentValues.codStatus).toBe("pending");
  });

  it("rejects deduct_from_settlement when COD amount is not greater than delivery fee", async () => {
    requirePermissionMock.mockResolvedValue({
      appUserId: "admin-1",
      role: { slug: "office_admin" },
      permissions: ["parcel.create"],
    });
    findMerchantByAppUserIdMock.mockResolvedValue({ id: "merchant-1" });
    getRiderByIdMock.mockResolvedValue({ id: "rider-1", isActive: true });
    findTownshipByIdMock.mockResolvedValue({ id: "township-1", isActive: true });

    const { createParcelAction } = await import("@/features/parcels/server/actions");
    const formData = new FormData();
    formData.set("merchantId", "7f048ecf-7989-4f2e-b0a2-97f950f53ea4");
    formData.set("riderId", "5f0ee80f-ad8d-40ce-8ded-d6fffe44f633");
    formData.set("recipientName", "Ko Aung");
    formData.set("recipientPhone", "0912345678");
    formData.set("recipientTownshipId", "c4e4c8c7-a43b-4c56-8913-8c98ebebc35f");
    formData.set("recipientAddress", "No 1, Street");
    formData.set("parcelType", "cod");
    formData.set("codAmount", "1000");
    formData.set("deliveryFee", "1500");
    formData.set("deliveryFeePayer", "merchant");
    formData.set("deliveryFeeStatus", "deduct_from_settlement");
    formData.set("paymentNote", "Handle with care");

    const result = await createParcelAction({ ok: true, message: "" }, formData);

    expect(result).toMatchObject({
      ok: false,
      message:
        "COD amount must be greater than delivery fee when delivery fee status is 'deduct_from_settlement'.",
    });
    expect(result.fields).toBeDefined();
    expect(createParcelWithPaymentAndAuditMock).not.toHaveBeenCalled();
  });

  it("blocks parcel updates from rider role for admin dashboard workflow", async () => {
    requirePermissionMock.mockResolvedValue({
      appUserId: "rider-1",
      role: { slug: "rider" },
      permissions: ["parcel.update"],
    });

    const { updateParcelAction } = await import("@/features/parcels/server/actions");
    const formData = new FormData();
    formData.set("parcelId", "7f048ecf-7989-4f2e-b0a2-97f950f53ea4");

    const result = await updateParcelAction({ ok: true, message: "" }, formData);

    expect(result).toMatchObject({
      ok: false,
      message: "Only super admin and office admin can update parcels.",
    });
    expect(result.fields).toMatchObject({
      parcelId: "7f048ecf-7989-4f2e-b0a2-97f950f53ea4",
    });
    expect(updateParcelAndPaymentWithAuditMock).not.toHaveBeenCalled();
  });
});
