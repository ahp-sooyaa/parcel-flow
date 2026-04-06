import "server-only";
import { randomInt } from "node:crypto";
import { z } from "zod";
import {
  COD_STATUSES,
  COLLECTION_STATUSES,
  DELIVERY_FEE_PAYERS,
  DELIVERY_FEE_STATUSES,
  MERCHANT_SETTLEMENT_STATUSES,
  PARCEL_STATUSES,
  PARCEL_TYPES,
  RIDER_PAYOUT_STATUSES,
} from "@/features/parcels/constants";
import { optionalNullableTrimmedString, optionalNullableUuid } from "@/lib/validation/zod-helpers";

import type { RoleSlug } from "@/db/constants";

export {
  COD_STATUSES,
  COLLECTION_STATUSES,
  DEFAULT_CREATE_PARCEL_STATE,
  DELIVERY_FEE_PAYERS,
  DELIVERY_FEE_STATUSES,
  MERCHANT_SETTLEMENT_STATUSES,
  PARCEL_STATUSES,
  PARCEL_TYPES,
  RIDER_PAYOUT_STATUSES,
} from "@/features/parcels/constants";

const moneyField = z.preprocess((value) => {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return Number.NaN;
  }

  const normalized = value.trim();

  if (!normalized) {
    return Number.NaN;
  }

  return Number(normalized);
}, z.number().finite().min(0).max(999999999));

export const createParcelSchema = z.object({
  merchantId: z.string().trim().uuid(),
  riderId: optionalNullableUuid(),
  recipientName: z.string().trim().min(2).max(120),
  recipientPhone: z.string().trim().min(6).max(30),
  recipientTownshipId: z.string().trim().uuid(),
  recipientAddress: z.string().trim().min(3).max(255),
  parcelType: z.enum(PARCEL_TYPES),
  codAmount: moneyField,
  deliveryFee: moneyField,
  deliveryFeePayer: z.enum(DELIVERY_FEE_PAYERS),
  deliveryFeeStatus: z.enum(DELIVERY_FEE_STATUSES),
  paymentNote: optionalNullableTrimmedString(1000),
});

export const updateParcelSchema = createParcelSchema
  .omit({
    deliveryFeeStatus: true,
  })
  .extend({
    parcelId: z.string().trim().uuid(),
    parcelStatus: z.enum(PARCEL_STATUSES),
    deliveryFeeStatus: z.enum(DELIVERY_FEE_STATUSES),
    codStatus: z.enum(COD_STATUSES),
    collectionStatus: z.enum(COLLECTION_STATUSES),
    merchantSettlementStatus: z.enum(MERCHANT_SETTLEMENT_STATUSES),
    riderPayoutStatus: z.enum(RIDER_PAYOUT_STATUSES),
    collectedAmount: moneyField,
  });

export type ParcelCreateInput = z.infer<typeof createParcelSchema>;
export type ParcelUpdateInput = z.infer<typeof updateParcelSchema>;

export function isAdminDashboardRole(roleSlug: RoleSlug) {
  return roleSlug === "super_admin" || roleSlug === "office_admin";
}

export function computeTotalAmountToCollect(input: {
  parcelType: (typeof PARCEL_TYPES)[number];
  codAmount: number;
  deliveryFee: number;
  deliveryFeePayer: (typeof DELIVERY_FEE_PAYERS)[number];
}) {
  const normalizedCodAmount = input.parcelType === "cod" ? input.codAmount : 0;

  if (input.deliveryFeePayer === "receiver") {
    return normalizedCodAmount + input.deliveryFee;
  }

  return normalizedCodAmount;
}

export function toMoneyString(value: number) {
  return value.toFixed(2);
}

function padCodeNumber(value: number, length: number) {
  return value.toString().padStart(length, "0");
}

export function generateParcelCode(date = new Date()) {
  const year = date.getFullYear().toString().slice(-2);
  const month = padCodeNumber(date.getMonth() + 1, 2);
  const day = padCodeNumber(date.getDate(), 2);
  const random = padCodeNumber(randomInt(0, 1_000_000), 6);

  return `PF-${year}${month}${day}-${random}`;
}

export function validateCreateDeliveryFeeState(input: {
  parcelType: (typeof PARCEL_TYPES)[number];
  codAmount: number;
  deliveryFee: number;
  deliveryFeeStatus: (typeof DELIVERY_FEE_STATUSES)[number];
}) {
  if (input.deliveryFeeStatus !== "deduct_from_settlement") {
    return { ok: true as const };
  }

  if (input.parcelType !== "cod") {
    return {
      ok: false as const,
      message: "Delivery fee status 'deduct_from_settlement' requires parcel type COD.",
    };
  }

  if (input.codAmount <= input.deliveryFee) {
    return {
      ok: false as const,
      message:
        "COD amount must be greater than delivery fee when delivery fee status is 'deduct_from_settlement'.",
    };
  }

  return { ok: true as const };
}

export function validateUpdateCodState(input: {
  parcelType: (typeof PARCEL_TYPES)[number];
  codStatus: (typeof COD_STATUSES)[number];
}) {
  if (input.parcelType === "non_cod" && input.codStatus !== "not_applicable") {
    return {
      ok: false as const,
      message: "COD status must be 'not_applicable' when parcel type is non-COD.",
    };
  }

  if (input.parcelType === "cod" && input.codStatus === "not_applicable") {
    return {
      ok: false as const,
      message: "COD status 'not_applicable' can only be used for non-COD parcels.",
    };
  }

  return { ok: true as const };
}
