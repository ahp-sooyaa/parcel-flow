export const PARCEL_TYPES = ["cod", "non_cod"] as const;
export const DELIVERY_FEE_PAYERS = ["merchant", "receiver"] as const;
export const DELIVERY_FEE_PAYMENT_PLANS = [
    "receiver_collect_on_delivery",
    "merchant_prepaid_bank_transfer",
    "merchant_cash_on_pickup",
    "merchant_deduct_from_cod_settlement",
    "merchant_bill_later",
] as const;
export const RECEIVER_DELIVERY_FEE_PAYMENT_PLANS = ["receiver_collect_on_delivery"] as const;
export const MERCHANT_DELIVERY_FEE_PAYMENT_PLANS = [
    "merchant_prepaid_bank_transfer",
    "merchant_cash_on_pickup",
    "merchant_deduct_from_cod_settlement",
    "merchant_bill_later",
] as const;
export const PARCEL_STATUSES = [
    "pending",
    "out_for_pickup",
    "at_office",
    "out_for_delivery",
    "delivered",
    "return_to_office",
    "return_to_merchant",
    "returned",
    "cancelled",
] as const;
export const DELIVERY_FEE_STATUSES = [
    "unpaid",
    "paid_by_merchant",
    "collected_from_receiver",
    "deduct_from_settlement",
    "bill_merchant",
    "waived",
] as const;
export const COD_STATUSES = ["not_applicable", "pending", "collected", "not_collected"] as const;
export const COLLECTION_STATUSES = [
    "pending",
    "not_collected",
    "collected_by_rider",
    "received_by_office",
    "void",
] as const;
export const MERCHANT_SETTLEMENT_STATUSES = ["pending", "in_progress", "settled"] as const;
export const RIDER_PAYOUT_STATUSES = ["pending", "in_progress", "paid"] as const;

export type ParcelStatusLabelValue =
    | (typeof PARCEL_TYPES)[number]
    | (typeof DELIVERY_FEE_PAYERS)[number]
    | (typeof DELIVERY_FEE_PAYMENT_PLANS)[number]
    | (typeof PARCEL_STATUSES)[number]
    | (typeof DELIVERY_FEE_STATUSES)[number]
    | (typeof COD_STATUSES)[number]
    | (typeof COLLECTION_STATUSES)[number]
    | (typeof MERCHANT_SETTLEMENT_STATUSES)[number]
    | (typeof RIDER_PAYOUT_STATUSES)[number];

export const DEFAULT_CREATE_PARCEL_STATE = {
    parcelStatus: "pending",
    deliveryFeeStatus: "unpaid",
    codStatus: "pending",
    collectionStatus: "pending",
    merchantSettlementStatus: "pending",
    riderPayoutStatus: "pending",
    deliveryFeePayer: "receiver",
    deliveryFeePaymentPlan: "receiver_collect_on_delivery",
} as const;

export function getDeliveryFeePaymentPlanOptions(input: {
    parcelType: (typeof PARCEL_TYPES)[number] | null | undefined;
    deliveryFeePayer: (typeof DELIVERY_FEE_PAYERS)[number] | null | undefined;
}): readonly (typeof DELIVERY_FEE_PAYMENT_PLANS)[number][] {
    if (input.deliveryFeePayer === "receiver") {
        return RECEIVER_DELIVERY_FEE_PAYMENT_PLANS;
    }

    if (input.deliveryFeePayer === "merchant") {
        return MERCHANT_DELIVERY_FEE_PAYMENT_PLANS.filter(
            (plan) => plan !== "merchant_deduct_from_cod_settlement" || input.parcelType === "cod",
        );
    }

    return [];
}

export function formatParcelStatusLabel(value: ParcelStatusLabelValue) {
    return value
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}
