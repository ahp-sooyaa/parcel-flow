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

export type ParcelViewerContext = {
  linkedMerchantId: string | null;
  linkedRiderId: string | null;
  role: {
    slug: RoleSlug;
  };
};

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

export function isAdminDashboardRole(roleSlug: RoleSlug) {
  return roleSlug === "super_admin" || roleSlug === "office_admin";
}

export function canAccessParcelList(viewer: ParcelViewerContext) {
  return isAdminDashboardRole(viewer.role.slug);
}

export function canViewParcel(viewer: ParcelViewerContext) {
  return (
    isAdminDashboardRole(viewer.role.slug) ||
    (viewer.role.slug === "merchant" && Boolean(viewer.linkedMerchantId)) ||
    (viewer.role.slug === "rider" && Boolean(viewer.linkedRiderId))
  );
}

export function canCreateParcel(viewer: ParcelViewerContext) {
  return (
    isAdminDashboardRole(viewer.role.slug) ||
    (viewer.role.slug === "merchant" && Boolean(viewer.linkedMerchantId))
  );
}

export function canEditParcel(viewer: ParcelViewerContext) {
  return (
    isAdminDashboardRole(viewer.role.slug) ||
    (viewer.role.slug === "merchant" && Boolean(viewer.linkedMerchantId))
  );
}

export function resolveMerchantScopedParcelOwner(input: {
  viewer: ParcelViewerContext;
  submittedMerchantId: string;
}) {
  if (input.viewer.role.slug !== "merchant") {
    return {
      ok: true as const,
      merchantId: input.submittedMerchantId,
    };
  }

  if (!input.viewer.linkedMerchantId) {
    return {
      ok: false as const,
      message: "Merchant account is not linked to a merchant profile.",
    };
  }

  if (input.submittedMerchantId !== input.viewer.linkedMerchantId) {
    return {
      ok: false as const,
      message: "Merchant users can only manage parcels for their own merchant profile.",
    };
  }

  return {
    ok: true as const,
    merchantId: input.viewer.linkedMerchantId,
  };
}

export function getNextRiderParcelAction(
  status: (typeof PARCEL_STATUSES)[number],
): RiderNextAction | null {
  return riderNextActionByStatus[status] ?? null;
}

export function canAdvanceRiderParcel(input: {
  viewer: ParcelViewerContext;
  assignedRiderId: string | null;
  currentStatus: (typeof PARCEL_STATUSES)[number];
  requestedNextStatus: (typeof PARCEL_STATUSES)[number];
}) {
  if (input.viewer.role.slug !== "rider") {
    return {
      ok: false as const,
      message: "Only rider users can perform rider workflow actions.",
    };
  }

  if (!input.viewer.linkedRiderId || input.assignedRiderId !== input.viewer.linkedRiderId) {
    return {
      ok: false as const,
      message: "Rider can only perform actions on assigned parcels.",
    };
  }

  const nextAction = getNextRiderParcelAction(input.currentStatus);

  if (!nextAction || nextAction.nextStatus !== input.requestedNextStatus) {
    return {
      ok: false as const,
      message: "Parcel status cannot be advanced with this rider action.",
    };
  }

  return {
    ok: true as const,
    nextAction,
  };
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
