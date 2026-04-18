import "server-only";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { findMerchantProfileLinkByAppUserId } from "@/features/merchant/server/dal";
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
import { getRiderById } from "@/features/rider/server/dal";
import { findTownshipById } from "@/features/townships/server/dal";
import { optionalNullableTrimmedString, optionalNullableUuid } from "@/lib/validation/zod-helpers";

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
  paymentNote: optionalNullableTrimmedString(1000),
});

export const updateParcelSchema = createParcelSchema.extend({
  parcelId: z.string().trim().uuid(),
  parcelStatus: z.enum(PARCEL_STATUSES),
  deliveryFeeStatus: z.enum(DELIVERY_FEE_STATUSES),
  codStatus: z.enum(COD_STATUSES),
  collectionStatus: z.enum(COLLECTION_STATUSES),
  merchantSettlementStatus: z.enum(MERCHANT_SETTLEMENT_STATUSES),
  riderPayoutStatus: z.enum(RIDER_PAYOUT_STATUSES),
  collectedAmount: moneyField,
});

export const advanceRiderParcelSchema = z.object({
  parcelId: z.string().trim().uuid(),
  nextStatus: z.enum(PARCEL_STATUSES),
});

export type ParcelCreateInput = z.infer<typeof createParcelSchema>;
export type ParcelUpdateInput = z.infer<typeof updateParcelSchema>;

export type RiderNextAction = {
  label: string;
  nextStatus: (typeof PARCEL_STATUSES)[number];
};

const riderNextActionByStatus: Partial<Record<(typeof PARCEL_STATUSES)[number], RiderNextAction>> =
  {
    pending: {
      label: "Start Pickup",
      nextStatus: "out_for_pickup",
    },
    out_for_pickup: {
      label: "Mark At Office",
      nextStatus: "at_office",
    },
    at_office: {
      label: "Start Delivery",
      nextStatus: "out_for_delivery",
    },
    out_for_delivery: {
      label: "Mark Delivered",
      nextStatus: "delivered",
    },
    return_to_office: {
      label: "Return To Merchant",
      nextStatus: "return_to_merchant",
    },
  };

export function getNextRiderParcelAction(
  status: (typeof PARCEL_STATUSES)[number],
): RiderNextAction | null {
  return riderNextActionByStatus[status] ?? null;
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

export function validateDeliveryFeeState(input: {
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

export function getDefaultCreateCodStatus(parcelType: (typeof PARCEL_TYPES)[number]) {
  return parcelType === "non_cod" ? "not_applicable" : "pending";
}

export async function validateParcelSubmission(input: {
  merchantId: string;
  riderId: string | null;
  recipientTownshipId: string;
  parcelType: (typeof PARCEL_TYPES)[number];
  codAmount: number;
  deliveryFee: number;
  deliveryFeeStatus?: (typeof DELIVERY_FEE_STATUSES)[number];
  codStatus: (typeof COD_STATUSES)[number];
}) {
  const merchant = await findMerchantProfileLinkByAppUserId(input.merchantId);

  if (!merchant) {
    return { ok: false as const, message: "Selected merchant was not found." };
  }

  if (input.riderId) {
    const rider = await getRiderById(input.riderId);

    if (!rider?.isActive) {
      return { ok: false as const, message: "Selected rider was not found." };
    }
  }

  const township = await findTownshipById(input.recipientTownshipId);

  if (!township?.isActive) {
    return { ok: false as const, message: "Selected recipient township was not found." };
  }

  if (input.deliveryFeeStatus) {
    const deliveryFeeStateGuard = validateDeliveryFeeState({
      parcelType: input.parcelType,
      codAmount: input.codAmount,
      deliveryFee: input.deliveryFee,
      deliveryFeeStatus: input.deliveryFeeStatus,
    });

    if (!deliveryFeeStateGuard.ok) {
      return deliveryFeeStateGuard;
    }
  }

  return validateUpdateCodState({
    parcelType: input.parcelType,
    codStatus: input.codStatus,
  });
}
