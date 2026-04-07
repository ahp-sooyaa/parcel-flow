import { describe, expect, it } from "vitest";
import {
  canCreateParcel,
  canEditParcel,
  canAdvanceRiderParcel,
  computeTotalAmountToCollect,
  createParcelSchema,
  DEFAULT_CREATE_PARCEL_STATE,
  getNextRiderParcelAction,
  resolveMerchantScopedParcelOwner,
  validateCreateDeliveryFeeState,
  updateParcelSchema,
} from "@/features/parcels/server/utils";

describe("parcels utils", () => {
  it("computes total amount to collect based on fee payer", () => {
    const receiverPays = computeTotalAmountToCollect({
      parcelType: "cod",
      codAmount: 10000,
      deliveryFee: 1500,
      deliveryFeePayer: "receiver",
    });
    const merchantPays = computeTotalAmountToCollect({
      parcelType: "cod",
      codAmount: 10000,
      deliveryFee: 1500,
      deliveryFeePayer: "merchant",
    });
    const nonCod = computeTotalAmountToCollect({
      parcelType: "non_cod",
      codAmount: 10000,
      deliveryFee: 1500,
      deliveryFeePayer: "receiver",
    });

    expect(receiverPays).toBe(11500);
    expect(merchantPays).toBe(10000);
    expect(nonCod).toBe(1500);
  });

  it("parses valid create parcel payload", () => {
    const result = createParcelSchema.safeParse({
      merchantId: "7f048ecf-7989-4f2e-b0a2-97f950f53ea4",
      riderId: "",
      recipientName: "Ko Aung",
      recipientPhone: "0912345678",
      recipientTownshipId: "5f0ee80f-ad8d-40ce-8ded-d6fffe44f633",
      recipientAddress: "No 1, Street",
      parcelType: "cod",
      codAmount: "12000",
      deliveryFee: "1500",
      deliveryFeePayer: "receiver",
      deliveryFeeStatus: "unpaid",
      paymentNote: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.riderId).toBeNull();
      expect(result.data.paymentNote).toBeNull();
    }
  });

  it("rejects invalid update parcel payload", () => {
    const result = updateParcelSchema.safeParse({
      parcelId: "not-a-uuid",
      merchantId: "7f048ecf-7989-4f2e-b0a2-97f950f53ea4",
      riderId: null,
      recipientName: "Ko Aung",
      recipientPhone: "0912345678",
      recipientTownshipId: "5f0ee80f-ad8d-40ce-8ded-d6fffe44f633",
      recipientAddress: "No 1, Street",
      parcelType: "cod",
      codAmount: 100,
      deliveryFee: 50,
      deliveryFeePayer: "receiver",
      parcelStatus: "pending",
      deliveryFeeStatus: "unpaid",
      codStatus: "pending",
      collectedAmount: 0,
      collectionStatus: "pending",
      merchantSettlementStatus: "pending",
      riderPayoutStatus: "pending",
      paymentNote: null,
    });

    expect(result.success).toBe(false);
  });

  it("keeps create defaults stable", () => {
    expect(DEFAULT_CREATE_PARCEL_STATE).toEqual({
      parcelStatus: "pending",
      deliveryFeeStatus: "unpaid",
      codStatus: "pending",
      collectionStatus: "pending",
      merchantSettlementStatus: "pending",
      riderPayoutStatus: "pending",
      deliveryFeePayer: "receiver",
    });
  });

  it("validates deduct_from_settlement rules", () => {
    const valid = validateCreateDeliveryFeeState({
      parcelType: "cod",
      codAmount: 12000,
      deliveryFee: 1500,
      deliveryFeeStatus: "deduct_from_settlement",
    });
    const invalidType = validateCreateDeliveryFeeState({
      parcelType: "non_cod",
      codAmount: 12000,
      deliveryFee: 1500,
      deliveryFeeStatus: "deduct_from_settlement",
    });
    const invalidAmount = validateCreateDeliveryFeeState({
      parcelType: "cod",
      codAmount: 1000,
      deliveryFee: 1500,
      deliveryFeeStatus: "deduct_from_settlement",
    });

    expect(valid.ok).toBe(true);
    expect(invalidType.ok).toBe(false);
    expect(invalidAmount.ok).toBe(false);
  });

  it("resolves merchant parcel ownership from the current merchant session", () => {
    const allowed = resolveMerchantScopedParcelOwner({
      viewer: {
        linkedMerchantId: "merchant-1",
        linkedRiderId: null,
        role: { slug: "merchant" },
      },
      submittedMerchantId: "merchant-1",
    });
    const denied = resolveMerchantScopedParcelOwner({
      viewer: {
        linkedMerchantId: "merchant-1",
        linkedRiderId: null,
        role: { slug: "merchant" },
      },
      submittedMerchantId: "merchant-2",
    });

    expect(allowed).toEqual({ ok: true, merchantId: "merchant-1" });
    expect(denied.ok).toBe(false);
  });

  it("derives rider next actions from parcel status", () => {
    expect(getNextRiderParcelAction("pending")).toEqual({
      label: "Start Pickup",
      nextStatus: "out_for_pickup",
    });
    expect(getNextRiderParcelAction("delivered")).toBeNull();
  });

  it("only allows rider transitions for assigned parcels and valid next statuses", () => {
    const allowed = canAdvanceRiderParcel({
      viewer: {
        linkedMerchantId: null,
        linkedRiderId: "rider-1",
        role: { slug: "rider" },
      },
      assignedRiderId: "rider-1",
      currentStatus: "pending",
      requestedNextStatus: "out_for_pickup",
    });
    const denied = canAdvanceRiderParcel({
      viewer: {
        linkedMerchantId: null,
        linkedRiderId: "rider-1",
        role: { slug: "rider" },
      },
      assignedRiderId: "rider-2",
      currentStatus: "pending",
      requestedNextStatus: "out_for_pickup",
    });

    expect(allowed.ok).toBe(true);
    expect(denied.ok).toBe(false);
  });

  it("requires a linked merchant profile before allowing merchant parcel create or edit", () => {
    expect(
      canCreateParcel({
        linkedMerchantId: null,
        linkedRiderId: null,
        role: { slug: "merchant" },
      }),
    ).toBe(false);
    expect(
      canEditParcel({
        linkedMerchantId: null,
        linkedRiderId: null,
        role: { slug: "merchant" },
      }),
    ).toBe(false);
  });
});
