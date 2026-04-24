import type {
    COD_STATUSES,
    COLLECTION_STATUSES,
    DELIVERY_FEE_PAYERS,
    DELIVERY_FEE_STATUSES,
    MERCHANT_SETTLEMENT_STATUSES,
    PARCEL_STATUSES,
    PARCEL_TYPES,
} from "../constants";

type ParcelPaymentStateInput = {
    parcelType: (typeof PARCEL_TYPES)[number];
    parcelStatus: (typeof PARCEL_STATUSES)[number];
    deliveryFeePayer: (typeof DELIVERY_FEE_PAYERS)[number];
    codAmount: number;
    deliveryFee: number;
    deliveryFeeStatus: (typeof DELIVERY_FEE_STATUSES)[number];
    previousDeliveryFeeStatus?: (typeof DELIVERY_FEE_STATUSES)[number];
    codStatus: (typeof COD_STATUSES)[number];
    collectionStatus: (typeof COLLECTION_STATUSES)[number];
    merchantSettlementStatus: (typeof MERCHANT_SETTLEMENT_STATUSES)[number];
    merchantSettlementId: string | null;
    paymentNote: string | null;
};

type GuardrailResult = { ok: true } | { ok: false; message: string };

function hasPaymentNote(value: string | null) {
    return Boolean(value?.trim());
}

export function validateParcelPaymentState(input: ParcelPaymentStateInput): GuardrailResult {
    if (input.parcelType === "non_cod" && input.codStatus !== "not_applicable") {
        return {
            ok: false,
            message: "COD status must be 'not_applicable' when parcel type is non-COD.",
        };
    }

    if (input.parcelType === "cod" && input.codStatus === "not_applicable") {
        return {
            ok: false,
            message: "COD parcels require a collectible COD status.",
        };
    }

    if (
        input.parcelType === "cod" &&
        input.parcelStatus === "delivered" &&
        input.codStatus === "pending"
    ) {
        return {
            ok: false,
            message: "Delivered COD parcels must have COD collection resolved.",
        };
    }

    if (input.collectionStatus === "received_by_office" && input.codStatus !== "collected") {
        return {
            ok: false,
            message: "Office cannot receive COD that was not collected.",
        };
    }

    if (
        input.deliveryFeePayer === "receiver" &&
        input.deliveryFeeStatus === "deduct_from_settlement"
    ) {
        return {
            ok: false,
            message: "Receiver-paid delivery fees cannot be deducted from merchant settlement.",
        };
    }

    if (
        input.deliveryFeePayer === "merchant" &&
        input.deliveryFeeStatus === "collected_from_receiver"
    ) {
        return {
            ok: false,
            message: "Merchant-paid delivery fees cannot be marked collected from receiver.",
        };
    }

    if (input.deliveryFeeStatus === "waived" && !hasPaymentNote(input.paymentNote)) {
        return {
            ok: false,
            message: "Waived delivery fees require a payment note.",
        };
    }

    if (input.merchantSettlementStatus === "pending" && input.merchantSettlementId) {
        return {
            ok: false,
            message: "Pending merchant settlement status cannot have a settlement link.",
        };
    }

    if (
        (input.merchantSettlementStatus === "in_progress" ||
            input.merchantSettlementStatus === "settled") &&
        !input.merchantSettlementId
    ) {
        return {
            ok: false,
            message: "Locked or settled merchant settlement status requires a settlement link.",
        };
    }

    if (input.deliveryFeeStatus !== "deduct_from_settlement") {
        return { ok: true };
    }

    if (input.parcelType !== "cod") {
        return {
            ok: false,
            message: "Delivery fee deduction requires a COD parcel.",
        };
    }

    if (input.parcelStatus !== "delivered") {
        return {
            ok: false,
            message: "Delivery fee deduction requires a delivered parcel.",
        };
    }

    if (input.codStatus !== "collected") {
        return {
            ok: false,
            message: "Delivery fee deduction requires collected COD.",
        };
    }

    if (input.collectionStatus !== "received_by_office") {
        return {
            ok: false,
            message: "Delivery fee deduction requires COD received by office.",
        };
    }

    if (input.deliveryFeePayer !== "merchant") {
        return {
            ok: false,
            message: "Delivery fee deduction requires merchant-paid delivery fee.",
        };
    }

    if (input.deliveryFee <= 0) {
        return {
            ok: false,
            message: "Delivery fee deduction requires a delivery fee greater than zero.",
        };
    }

    if (input.codAmount <= input.deliveryFee) {
        return {
            ok: false,
            message: "COD amount must be greater than delivery fee for settlement deduction.",
        };
    }

    const isSettlementLocked =
        input.merchantSettlementStatus !== "pending" || Boolean(input.merchantSettlementId);

    if (isSettlementLocked && input.previousDeliveryFeeStatus !== "deduct_from_settlement") {
        return {
            ok: false,
            message: "Delivery fee deduction is only allowed before merchant settlement locking.",
        };
    }

    return { ok: true };
}
