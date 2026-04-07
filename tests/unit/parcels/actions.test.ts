import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const getCurrentUserContextMock = vi.hoisted(() => vi.fn());
const findMerchantByAppUserIdMock = vi.hoisted(() => vi.fn());
const getRiderByIdMock = vi.hoisted(() => vi.fn());
const findTownshipByIdMock = vi.hoisted(() => vi.fn());
const createParcelWithPaymentAndAuditMock = vi.hoisted(() => vi.fn());
const getParcelUpdateContextMock = vi.hoisted(() => vi.fn());
const getRiderParcelByIdMock = vi.hoisted(() => vi.fn());
const isParcelCodeInUseMock = vi.hoisted(() => vi.fn());
const updateParcelAndPaymentWithAuditMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/features/auth/server/utils", () => ({
  getCurrentUserContext: getCurrentUserContextMock,
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
    getRiderParcelById: getRiderParcelByIdMock,
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

  it("creates parcel with submitted fee payer and delivery fee status", async () => {
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

  it("rejects non-COD parcel creation because create defaults keep COD status pending", async () => {
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
    formData.set("parcelType", "non_cod");
    formData.set("codAmount", "0");
    formData.set("deliveryFee", "1500");
    formData.set("deliveryFeePayer", "receiver");
    formData.set("deliveryFeeStatus", "unpaid");

    const result = await createParcelAction({ ok: true, message: "" }, formData);

    expect(result).toMatchObject({
      ok: false,
      message: "COD status must be 'not_applicable' when parcel type is non-COD.",
    });
    expect(result.fields).toMatchObject({
      parcelType: "non_cod",
    });
    expect(createParcelWithPaymentAndAuditMock).not.toHaveBeenCalled();
  });

  it("allows merchant users to create parcels only for their own merchant profile", async () => {
    requirePermissionMock.mockResolvedValue({
      appUserId: "merchant-user-1",
      linkedMerchantId: "7f048ecf-7989-4f2e-b0a2-97f950f53ea4",
      linkedRiderId: null,
      role: { slug: "merchant" },
      permissions: ["parcel.create", "merchant.view"],
    });
    findMerchantByAppUserIdMock.mockResolvedValue({ id: "merchant-1" });
    findTownshipByIdMock.mockResolvedValue({ id: "township-1", isActive: true });
    isParcelCodeInUseMock.mockResolvedValue(false);
    createParcelWithPaymentAndAuditMock.mockResolvedValue({ parcelId: "parcel-1" });

    const { createParcelAction } = await import("@/features/parcels/server/actions");
    const formData = new FormData();
    formData.set("merchantId", "7f048ecf-7989-4f2e-b0a2-97f950f53ea4");
    formData.set("riderId", "");
    formData.set("recipientName", "Ko Aung");
    formData.set("recipientPhone", "0912345678");
    formData.set("recipientTownshipId", "c4e4c8c7-a43b-4c56-8913-8c98ebebc35f");
    formData.set("recipientAddress", "No 1, Street");
    formData.set("parcelType", "cod");
    formData.set("codAmount", "12000");
    formData.set("deliveryFee", "1500");
    formData.set("deliveryFeePayer", "receiver");
    formData.set("deliveryFeeStatus", "unpaid");

    const result = await createParcelAction({ ok: true, message: "" }, formData);

    expect(result.ok).toBe(true);
    expect(createParcelWithPaymentAndAuditMock.mock.calls[0][0].parcelValues.merchantId).toBe(
      "7f048ecf-7989-4f2e-b0a2-97f950f53ea4",
    );
  });

  it("rejects merchant create attempts for another merchant profile", async () => {
    requirePermissionMock.mockResolvedValue({
      appUserId: "merchant-user-1",
      linkedMerchantId: "7f048ecf-7989-4f2e-b0a2-97f950f53ea4",
      linkedRiderId: null,
      role: { slug: "merchant" },
      permissions: ["parcel.create", "merchant.view"],
    });

    const { createParcelAction } = await import("@/features/parcels/server/actions");
    const formData = new FormData();
    formData.set("merchantId", "5f0ee80f-ad8d-40ce-8ded-d6fffe44f633");
    formData.set("riderId", "");
    formData.set("recipientName", "Ko Aung");
    formData.set("recipientPhone", "0912345678");
    formData.set("recipientTownshipId", "c4e4c8c7-a43b-4c56-8913-8c98ebebc35f");
    formData.set("recipientAddress", "No 1, Street");
    formData.set("parcelType", "cod");
    formData.set("codAmount", "12000");
    formData.set("deliveryFee", "1500");
    formData.set("deliveryFeePayer", "receiver");
    formData.set("deliveryFeeStatus", "unpaid");

    const result = await createParcelAction({ ok: true, message: "" }, formData);

    expect(result).toMatchObject({
      ok: false,
      message: "Merchant users can only manage parcels for their own merchant profile.",
    });
  });

  it("rejects merchant create when the account is not linked to a merchant profile", async () => {
    requirePermissionMock.mockResolvedValue({
      appUserId: "merchant-user-1",
      linkedMerchantId: null,
      linkedRiderId: null,
      role: { slug: "merchant" },
      permissions: ["parcel.create", "merchant.view"],
    });

    const { createParcelAction } = await import("@/features/parcels/server/actions");
    const formData = new FormData();
    formData.set("merchantId", "5f0ee80f-ad8d-40ce-8ded-d6fffe44f633");
    formData.set("riderId", "");
    formData.set("recipientName", "Ko Aung");
    formData.set("recipientPhone", "0912345678");
    formData.set("recipientTownshipId", "c4e4c8c7-a43b-4c56-8913-8c98ebebc35f");
    formData.set("recipientAddress", "No 1, Street");
    formData.set("parcelType", "cod");
    formData.set("codAmount", "12000");
    formData.set("deliveryFee", "1500");
    formData.set("deliveryFeePayer", "receiver");
    formData.set("deliveryFeeStatus", "unpaid");

    const result = await createParcelAction({ ok: true, message: "" }, formData);

    expect(result).toMatchObject({
      ok: false,
      message: "You are not allowed to create parcels.",
    });
  });

  it("allows rider to advance an assigned parcel with the next valid status", async () => {
    getCurrentUserContextMock.mockResolvedValue({
      appUserId: "rider-user-1",
      linkedMerchantId: null,
      linkedRiderId: "rider-1",
      role: { slug: "rider" },
      permissions: ["rider.update", "parcel.view"],
    });
    getRiderParcelByIdMock.mockResolvedValue({ id: "parcel-1", nextAction: null });
    getParcelUpdateContextMock.mockResolvedValue({
      parcel: {
        id: "parcel-1",
        parcelCode: "PF-001",
        merchantId: "merchant-1",
        riderId: "rider-1",
        recipientName: "Ko Aung",
        recipientPhone: "0912345678",
        recipientTownshipId: "township-1",
        recipientAddress: "Street",
        parcelType: "cod",
        codAmount: "1000",
        deliveryFee: "100",
        totalAmountToCollect: "1100",
        deliveryFeePayer: "receiver",
        status: "pending",
      },
      payment: {
        id: "payment-1",
        deliveryFeeStatus: "unpaid",
        codStatus: "pending",
        collectedAmount: "0",
        collectionStatus: "pending",
        merchantSettlementStatus: "pending",
        riderPayoutStatus: "pending",
        note: null,
      },
    });

    const { advanceRiderParcelAction } = await import("@/features/parcels/server/actions");
    const result = await advanceRiderParcelAction("parcel-1", "out_for_pickup");

    expect(result).toEqual({
      ok: true,
      message: "Start Pickup completed.",
    });
    expect(updateParcelAndPaymentWithAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        parcelId: "parcel-1",
        parcelPatch: { status: "out_for_pickup" },
        parcelEvent: "parcel.rider_progressed",
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/parcels");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/parcels/parcel-1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/parcels/parcel-1/edit");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/merchants/merchant-1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/riders/rider-1");
  });

  it("rejects rider transition when the requested status is not the next allowed step", async () => {
    getCurrentUserContextMock.mockResolvedValue({
      appUserId: "rider-user-1",
      linkedMerchantId: null,
      linkedRiderId: "rider-1",
      role: { slug: "rider" },
      permissions: ["rider.update", "parcel.view"],
    });
    getParcelUpdateContextMock.mockResolvedValue({
      parcel: {
        id: "parcel-1",
        parcelCode: "PF-001",
        merchantId: "merchant-1",
        riderId: "rider-1",
        recipientName: "Ko Aung",
        recipientPhone: "0912345678",
        recipientTownshipId: "township-1",
        recipientAddress: "Street",
        parcelType: "cod",
        codAmount: "1000",
        deliveryFee: "100",
        totalAmountToCollect: "1100",
        deliveryFeePayer: "receiver",
        status: "pending",
      },
      payment: {
        id: "payment-1",
        deliveryFeeStatus: "unpaid",
        codStatus: "pending",
        collectedAmount: "0",
        collectionStatus: "pending",
        merchantSettlementStatus: "pending",
        riderPayoutStatus: "pending",
        note: null,
      },
    });
    getRiderParcelByIdMock.mockResolvedValue({ id: "parcel-1", nextAction: null });

    const { advanceRiderParcelAction } = await import("@/features/parcels/server/actions");
    const result = await advanceRiderParcelAction("parcel-1", "delivered");

    expect(result).toMatchObject({
      ok: false,
      message: "Parcel status cannot be advanced with this rider action.",
    });
  });

  it("rejects merchant updates for another merchant parcel", async () => {
    const ownedMerchantId = "7f048ecf-7989-4f2e-b0a2-97f950f53ea4";
    const otherMerchantId = "5f0ee80f-ad8d-40ce-8ded-d6fffe44f633";

    getCurrentUserContextMock.mockResolvedValue({
      appUserId: "merchant-user-1",
      linkedMerchantId: ownedMerchantId,
      linkedRiderId: null,
      role: { slug: "merchant" },
      permissions: ["parcel.update", "merchant.update", "parcel.view"],
    });

    const { updateParcelAction } = await import("@/features/parcels/server/actions");
    const formData = new FormData();
    formData.set("parcelId", "7f048ecf-7989-4f2e-b0a2-97f950f53ea4");
    formData.set("merchantId", otherMerchantId);
    formData.set("riderId", "");
    formData.set("recipientName", "Ko Aung");
    formData.set("recipientPhone", "0912345678");
    formData.set("recipientTownshipId", "c4e4c8c7-a43b-4c56-8913-8c98ebebc35f");
    formData.set("recipientAddress", "No 1, Street");
    formData.set("parcelType", "cod");
    formData.set("codAmount", "12000");
    formData.set("deliveryFee", "1500");
    formData.set("deliveryFeePayer", "receiver");
    formData.set("parcelStatus", "pending");
    formData.set("deliveryFeeStatus", "unpaid");
    formData.set("codStatus", "pending");
    formData.set("collectedAmount", "0");
    formData.set("collectionStatus", "pending");
    formData.set("merchantSettlementStatus", "pending");
    formData.set("riderPayoutStatus", "pending");
    formData.set("paymentNote", "");

    const result = await updateParcelAction({ ok: true, message: "" }, formData);

    expect(result).toMatchObject({
      ok: false,
      message: "Merchant users can only manage parcels for their own merchant profile.",
    });
  });

  it("rejects rider transition for unassigned parcel", async () => {
    getCurrentUserContextMock.mockResolvedValue({
      appUserId: "rider-user-1",
      linkedMerchantId: null,
      linkedRiderId: "rider-1",
      role: { slug: "rider" },
      permissions: ["rider.update", "parcel.view"],
    });
    getParcelUpdateContextMock.mockResolvedValue({
      parcel: {
        id: "parcel-1",
        parcelCode: "PF-001",
        merchantId: "merchant-1",
        riderId: "rider-2",
        recipientName: "Ko Aung",
        recipientPhone: "0912345678",
        recipientTownshipId: "township-1",
        recipientAddress: "Street",
        parcelType: "cod",
        codAmount: "1000",
        deliveryFee: "100",
        totalAmountToCollect: "1100",
        deliveryFeePayer: "receiver",
        status: "pending",
      },
      payment: {
        id: "payment-1",
        deliveryFeeStatus: "unpaid",
        codStatus: "pending",
        collectedAmount: "0",
        collectionStatus: "pending",
        merchantSettlementStatus: "pending",
        riderPayoutStatus: "pending",
        note: null,
      },
    });
    getRiderParcelByIdMock.mockResolvedValue({
      id: "parcel-1",
      nextAction: null,
    });

    const { advanceRiderParcelAction } = await import("@/features/parcels/server/actions");
    const result = await advanceRiderParcelAction("parcel-1", "out_for_pickup");

    expect(result).toMatchObject({
      ok: false,
      message: "Rider can only perform actions on assigned parcels.",
    });
  });

  it("preserves admin cancellation behavior during parcel update", async () => {
    const merchantId = "7f048ecf-7989-4f2e-b0a2-97f950f53ea4";

    getCurrentUserContextMock.mockResolvedValue({
      appUserId: "admin-1",
      linkedMerchantId: null,
      linkedRiderId: null,
      role: { slug: "office_admin" },
      permissions: ["parcel.update"],
    });
    findMerchantByAppUserIdMock.mockResolvedValue({ id: "merchant-1" });
    findTownshipByIdMock.mockResolvedValue({ id: "township-1", isActive: true });
    getParcelUpdateContextMock.mockResolvedValue({
      parcel: {
        id: "parcel-1",
        parcelCode: "PF-001",
        merchantId,
        riderId: null,
        recipientName: "Ko Aung",
        recipientPhone: "0912345678",
        recipientTownshipId: "township-1",
        recipientAddress: "Street",
        parcelType: "cod",
        codAmount: "1000",
        deliveryFee: "100",
        totalAmountToCollect: "1100",
        deliveryFeePayer: "receiver",
        status: "pending",
      },
      payment: {
        id: "payment-1",
        deliveryFeeStatus: "unpaid",
        codStatus: "pending",
        collectedAmount: "0",
        collectionStatus: "pending",
        merchantSettlementStatus: "pending",
        riderPayoutStatus: "pending",
        note: null,
      },
    });

    const { updateParcelAction } = await import("@/features/parcels/server/actions");
    const formData = new FormData();
    formData.set("parcelId", "7f048ecf-7989-4f2e-b0a2-97f950f53ea4");
    formData.set("merchantId", merchantId);
    formData.set("riderId", "");
    formData.set("recipientName", "Ko Aung");
    formData.set("recipientPhone", "0912345678");
    formData.set("recipientTownshipId", "c4e4c8c7-a43b-4c56-8913-8c98ebebc35f");
    formData.set("recipientAddress", "No 1, Street");
    formData.set("parcelType", "cod");
    formData.set("codAmount", "1000");
    formData.set("deliveryFee", "100");
    formData.set("deliveryFeePayer", "receiver");
    formData.set("parcelStatus", "cancelled");
    formData.set("deliveryFeeStatus", "unpaid");
    formData.set("codStatus", "pending");
    formData.set("collectedAmount", "0");
    formData.set("collectionStatus", "pending");
    formData.set("merchantSettlementStatus", "pending");
    formData.set("riderPayoutStatus", "pending");
    formData.set("paymentNote", "");

    const result = await updateParcelAction({ ok: true, message: "" }, formData);

    expect(result.ok).toBe(true);
    expect(updateParcelAndPaymentWithAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        parcelEvent: "parcel.cancelled",
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/parcels");
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/dashboard/parcels/7f048ecf-7989-4f2e-b0a2-97f950f53ea4",
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/dashboard/parcels/7f048ecf-7989-4f2e-b0a2-97f950f53ea4/edit",
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(`/dashboard/merchants/${merchantId}`);
  });

  it("keeps merchant parcel updates from changing internal accounting fields", async () => {
    const merchantId = "7f048ecf-7989-4f2e-b0a2-97f950f53ea4";
    const parcelId = "5f0ee80f-ad8d-40ce-8ded-d6fffe44f633";

    getCurrentUserContextMock.mockResolvedValue({
      appUserId: "merchant-user-1",
      linkedMerchantId: merchantId,
      linkedRiderId: null,
      role: { slug: "merchant" },
      permissions: ["parcel.update", "merchant.update", "parcel.view"],
    });
    findMerchantByAppUserIdMock.mockResolvedValue({ id: "merchant-1" });
    getRiderByIdMock.mockResolvedValue({ id: "rider-1", isActive: true });
    findTownshipByIdMock.mockResolvedValue({ id: "township-1", isActive: true });
    getParcelUpdateContextMock.mockResolvedValue({
      parcel: {
        id: parcelId,
        parcelCode: "PF-001",
        merchantId,
        riderId: "rider-1",
        recipientName: "Ko Aung",
        recipientPhone: "0912345678",
        recipientTownshipId: "township-1",
        recipientAddress: "Street",
        parcelType: "cod",
        codAmount: "1000",
        deliveryFee: "100",
        totalAmountToCollect: "1100",
        deliveryFeePayer: "receiver",
        status: "at_office",
      },
      payment: {
        id: "payment-1",
        deliveryFeeStatus: "unpaid",
        codStatus: "pending",
        collectedAmount: "0",
        collectionStatus: "pending",
        merchantSettlementStatus: "pending",
        riderPayoutStatus: "pending",
        note: "office note",
      },
    });

    const { updateParcelAction } = await import("@/features/parcels/server/actions");
    const formData = new FormData();
    formData.set("parcelId", parcelId);
    formData.set("merchantId", merchantId);
    formData.set("riderId", "");
    formData.set("recipientName", "Ko Aung Updated");
    formData.set("recipientPhone", "0912345678");
    formData.set("recipientTownshipId", "c4e4c8c7-a43b-4c56-8913-8c98ebebc35f");
    formData.set("recipientAddress", "No 1, Street");
    formData.set("parcelType", "cod");
    formData.set("codAmount", "12000");
    formData.set("deliveryFee", "1500");
    formData.set("deliveryFeePayer", "receiver");
    formData.set("parcelStatus", "cancelled");
    formData.set("deliveryFeeStatus", "deduct_from_settlement");
    formData.set("codStatus", "collected");
    formData.set("collectedAmount", "12000");
    formData.set("collectionStatus", "received_by_office");
    formData.set("merchantSettlementStatus", "settled");
    formData.set("riderPayoutStatus", "paid");
    formData.set("paymentNote", "merchant tamper");

    const result = await updateParcelAction({ ok: true, message: "" }, formData);

    expect(result.ok).toBe(true);
    expect(updateParcelAndPaymentWithAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        parcelPatch: expect.not.objectContaining({
          status: "cancelled",
          riderId: null,
        }),
        paymentPatch: expect.not.objectContaining({
          deliveryFeeStatus: "deduct_from_settlement",
          codStatus: "collected",
          collectedAmount: "12000.00",
          collectionStatus: "received_by_office",
          merchantSettlementStatus: "settled",
          riderPayoutStatus: "paid",
          note: "merchant tamper",
        }),
        parcelEvent: "parcel.update",
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/parcels");
    expect(revalidatePathMock).toHaveBeenCalledWith(`/dashboard/parcels/${parcelId}`);
    expect(revalidatePathMock).toHaveBeenCalledWith(`/dashboard/parcels/${parcelId}/edit`);
    expect(revalidatePathMock).toHaveBeenCalledWith(`/dashboard/merchants/${merchantId}`);
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/riders/rider-1");
  });

  it("rejects merchant update when scoped COD status would make a non-COD parcel invalid", async () => {
    const merchantId = "7f048ecf-7989-4f2e-b0a2-97f950f53ea4";
    const parcelId = "5f0ee80f-ad8d-40ce-8ded-d6fffe44f633";

    getCurrentUserContextMock.mockResolvedValue({
      appUserId: "merchant-user-1",
      linkedMerchantId: merchantId,
      linkedRiderId: null,
      role: { slug: "merchant" },
      permissions: ["parcel.update", "parcel.create"],
    });
    findMerchantByAppUserIdMock.mockResolvedValue({ id: "merchant-1" });
    findTownshipByIdMock.mockResolvedValue({ id: "township-1", isActive: true });
    getParcelUpdateContextMock.mockResolvedValue({
      parcel: {
        id: parcelId,
        parcelCode: "PF-001",
        merchantId,
        riderId: null,
        recipientName: "Ko Aung",
        recipientPhone: "0912345678",
        recipientTownshipId: "township-1",
        recipientAddress: "Street",
        parcelType: "cod",
        codAmount: "1000",
        deliveryFee: "100",
        totalAmountToCollect: "1100",
        deliveryFeePayer: "receiver",
        status: "pending",
      },
      payment: {
        id: "payment-1",
        deliveryFeeStatus: "unpaid",
        codStatus: "pending",
        collectedAmount: "0",
        collectionStatus: "pending",
        merchantSettlementStatus: "pending",
        riderPayoutStatus: "pending",
        note: null,
      },
    });

    const { updateParcelAction } = await import("@/features/parcels/server/actions");
    const formData = new FormData();
    formData.set("parcelId", parcelId);
    formData.set("merchantId", merchantId);
    formData.set("riderId", "");
    formData.set("recipientName", "Ko Aung");
    formData.set("recipientPhone", "0912345678");
    formData.set("recipientTownshipId", "c4e4c8c7-a43b-4c56-8913-8c98ebebc35f");
    formData.set("recipientAddress", "No 1, Street");
    formData.set("parcelType", "non_cod");
    formData.set("codAmount", "0");
    formData.set("deliveryFee", "100");
    formData.set("deliveryFeePayer", "receiver");
    formData.set("parcelStatus", "pending");
    formData.set("deliveryFeeStatus", "unpaid");
    formData.set("codStatus", "not_applicable");
    formData.set("collectedAmount", "0");
    formData.set("collectionStatus", "pending");
    formData.set("merchantSettlementStatus", "pending");
    formData.set("riderPayoutStatus", "pending");
    formData.set("paymentNote", "");

    const result = await updateParcelAction({ ok: true, message: "" }, formData);

    expect(result).toMatchObject({
      ok: false,
      message: "COD status must be 'not_applicable' when parcel type is non-COD.",
    });
    expect(updateParcelAndPaymentWithAuditMock).not.toHaveBeenCalled();
  });

  it("rejects merchant update when scoped delivery fee status would violate settlement rules", async () => {
    const merchantId = "7f048ecf-7989-4f2e-b0a2-97f950f53ea4";
    const parcelId = "5f0ee80f-ad8d-40ce-8ded-d6fffe44f633";

    getCurrentUserContextMock.mockResolvedValue({
      appUserId: "merchant-user-1",
      linkedMerchantId: merchantId,
      linkedRiderId: null,
      role: { slug: "merchant" },
      permissions: ["parcel.update", "parcel.create"],
    });
    findMerchantByAppUserIdMock.mockResolvedValue({ id: "merchant-1" });
    findTownshipByIdMock.mockResolvedValue({ id: "township-1", isActive: true });
    getParcelUpdateContextMock.mockResolvedValue({
      parcel: {
        id: parcelId,
        parcelCode: "PF-001",
        merchantId,
        riderId: null,
        recipientName: "Ko Aung",
        recipientPhone: "0912345678",
        recipientTownshipId: "township-1",
        recipientAddress: "Street",
        parcelType: "cod",
        codAmount: "1000",
        deliveryFee: "100",
        totalAmountToCollect: "1100",
        deliveryFeePayer: "receiver",
        status: "pending",
      },
      payment: {
        id: "payment-1",
        deliveryFeeStatus: "deduct_from_settlement",
        codStatus: "pending",
        collectedAmount: "0",
        collectionStatus: "pending",
        merchantSettlementStatus: "pending",
        riderPayoutStatus: "pending",
        note: null,
      },
    });

    const { updateParcelAction } = await import("@/features/parcels/server/actions");
    const formData = new FormData();
    formData.set("parcelId", parcelId);
    formData.set("merchantId", merchantId);
    formData.set("riderId", "");
    formData.set("recipientName", "Ko Aung");
    formData.set("recipientPhone", "0912345678");
    formData.set("recipientTownshipId", "c4e4c8c7-a43b-4c56-8913-8c98ebebc35f");
    formData.set("recipientAddress", "No 1, Street");
    formData.set("parcelType", "cod");
    formData.set("codAmount", "100");
    formData.set("deliveryFee", "150");
    formData.set("deliveryFeePayer", "receiver");
    formData.set("parcelStatus", "pending");
    formData.set("deliveryFeeStatus", "unpaid");
    formData.set("codStatus", "pending");
    formData.set("collectedAmount", "0");
    formData.set("collectionStatus", "pending");
    formData.set("merchantSettlementStatus", "pending");
    formData.set("riderPayoutStatus", "pending");
    formData.set("paymentNote", "");

    const result = await updateParcelAction({ ok: true, message: "" }, formData);

    expect(result).toMatchObject({
      ok: false,
      message:
        "COD amount must be greater than delivery fee when delivery fee status is 'deduct_from_settlement'.",
    });
    expect(updateParcelAndPaymentWithAuditMock).not.toHaveBeenCalled();
  });
});
