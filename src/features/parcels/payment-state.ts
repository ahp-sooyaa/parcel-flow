import {
    COD_STATUSES,
    COLLECTION_STATUSES,
    DELIVERY_FEE_PAYERS,
    DELIVERY_FEE_PAYMENT_PLANS,
    DELIVERY_FEE_STATUSES,
    MERCHANT_SETTLEMENT_STATUSES,
    PARCEL_STATUSES,
    PARCEL_TYPES,
} from "./constants";

export type ParcelPaymentStateInput = {
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

type ParcelFieldErrors = Partial<Record<string, string[]>>;

type DeliveryFeeStatusValidationInput = {
    deliveryFeePayer: (typeof DELIVERY_FEE_PAYERS)[number];
    deliveryFeePaymentPlan: (typeof DELIVERY_FEE_PAYMENT_PLANS)[number] | null;
    parcelStatus: (typeof PARCEL_STATUSES)[number];
    deliveryFeeStatus: (typeof DELIVERY_FEE_STATUSES)[number];
    fieldName?: string;
};

export type ParcelCorrectionState = Pick<
    ParcelPaymentStateInput,
    "parcelStatus" | "deliveryFeeStatus" | "codStatus" | "collectionStatus"
>;

export type ParcelCorrectionStateInput = ParcelPaymentStateInput & {
    deliveryFeePaymentPlan: (typeof DELIVERY_FEE_PAYMENT_PLANS)[number] | null;
};

export type ParcelCorrectionOptions = {
    parcelStatuses: (typeof PARCEL_STATUSES)[number][];
    deliveryFeeStatuses: (typeof DELIVERY_FEE_STATUSES)[number][];
    codStatuses: (typeof COD_STATUSES)[number][];
    collectionStatuses: (typeof COLLECTION_STATUSES)[number][];
};

const merchantLegacyDeliveryFeeStatuses = [
    "unpaid",
    "paid_by_merchant",
    "deduct_from_settlement",
    "bill_merchant",
    "waived",
] as const;
const receiverLegacyDeliveryFeeStatuses = ["unpaid", "collected_from_receiver", "waived"] as const;
const prepaidDeliveryFeeStatuses = ["unpaid", "paid_by_merchant", "waived"] as const;
const billLaterDeliveryFeeStatuses = ["unpaid", "bill_merchant", "waived"] as const;
const receiverCollectDeliveryFeeStatuses = ["unpaid", "collected_from_receiver", "waived"] as const;
const deductFromSettlementDeliveryFeeStatuses = [
    "unpaid",
    "deduct_from_settlement",
    "waived",
] as const;
const deductPlanFallbackDeliveryFeeStatuses = ["unpaid", "bill_merchant", "waived"] as const;

function createFieldErrors(fieldName: string, message: string): ParcelFieldErrors {
    return {
        [fieldName]: [message],
    };
}

function hasPaymentNote(value: string | null) {
    return Boolean(value?.trim());
}

function isDeliveredParcel(status: ParcelPaymentStateInput["parcelStatus"]) {
    return status === "delivered";
}

function normalizeOptionValidationNote(input: ParcelCorrectionStateInput) {
    if (input.deliveryFeeStatus !== "waived") {
        return input.paymentNote;
    }

    return input.paymentNote?.trim() ? input.paymentNote : "Delivery fee waived by office.";
}

function isValidCorrectionState(input: ParcelCorrectionStateInput) {
    const deliveryFeeStatusGuard = validateDeliveryFeeStatusForParcel({
        deliveryFeePayer: input.deliveryFeePayer,
        deliveryFeePaymentPlan: input.deliveryFeePaymentPlan,
        parcelStatus: input.parcelStatus,
        deliveryFeeStatus: input.deliveryFeeStatus,
    });

    if (!deliveryFeeStatusGuard.ok) {
        return false;
    }

    return validateParcelPaymentState({
        ...input,
        paymentNote: normalizeOptionValidationNote(input),
    }).ok;
}

function getCorrectionStateScore(
    preferred: ParcelCorrectionState,
    candidate: ParcelCorrectionState,
    prioritizedField?: keyof ParcelCorrectionState,
) {
    let score = 0;

    if (candidate.parcelStatus === preferred.parcelStatus) {
        score += 1;
    }

    if (candidate.deliveryFeeStatus === preferred.deliveryFeeStatus) {
        score += 1;
    }

    if (candidate.codStatus === preferred.codStatus) {
        score += 1;
    }

    if (candidate.collectionStatus === preferred.collectionStatus) {
        score += 1;
    }

    if (prioritizedField && candidate[prioritizedField] === preferred[prioritizedField]) {
        score += 8;
    }

    return score;
}

export function validateParcelPaymentState(input: ParcelPaymentStateInput): GuardrailResult {
    if (input.parcelType === "non_cod" && input.codStatus !== "not_applicable") {
        return {
            ok: false,
            message: "COD status must be 'not_applicable' when parcel type is non-COD.",
        };
    }

    if (input.parcelType === "non_cod" && input.collectionStatus !== "void") {
        return {
            ok: false,
            message: "Collection status must be 'void' when parcel type is non-COD.",
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

    if (input.collectionStatus === "collected_by_rider" && !isDeliveredParcel(input.parcelStatus)) {
        return {
            ok: false,
            message: "Rider-held COD cash requires a delivered parcel.",
        };
    }

    if (input.collectionStatus === "received_by_office" && !isDeliveredParcel(input.parcelStatus)) {
        return {
            ok: false,
            message: "Office-received COD cash requires a delivered parcel.",
        };
    }

    if (input.codStatus === "collected" && !isDeliveredParcel(input.parcelStatus)) {
        return {
            ok: false,
            message: "Collected COD requires a delivered parcel.",
        };
    }

    if (input.collectionStatus === "collected_by_rider" && input.codStatus !== "collected") {
        return {
            ok: false,
            message: "Rider cannot hold COD cash that was not collected.",
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

    if (
        input.deliveryFeeStatus === "collected_from_receiver" &&
        !isDeliveredParcel(input.parcelStatus)
    ) {
        return {
            ok: false,
            message: "Receiver-paid delivery fee collection requires a delivered parcel.",
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

export function getAllowedDeliveryFeeStatusesForParcel(input: {
    deliveryFeePayer: (typeof DELIVERY_FEE_PAYERS)[number];
    deliveryFeePaymentPlan: (typeof DELIVERY_FEE_PAYMENT_PLANS)[number] | null;
    parcelStatus: (typeof PARCEL_STATUSES)[number];
}): readonly (typeof DELIVERY_FEE_STATUSES)[number][] {
    if (!input.deliveryFeePaymentPlan) {
        return input.deliveryFeePayer === "merchant"
            ? merchantLegacyDeliveryFeeStatuses
            : receiverLegacyDeliveryFeeStatuses;
    }

    switch (input.deliveryFeePaymentPlan) {
        case "merchant_prepaid_bank_transfer":
        case "merchant_cash_on_pickup":
            return prepaidDeliveryFeeStatuses;
        case "merchant_bill_later":
            return billLaterDeliveryFeeStatuses;
        case "receiver_collect_on_delivery":
            return receiverCollectDeliveryFeeStatuses;
        case "merchant_deduct_from_cod_settlement":
            return input.parcelStatus === "returned" || input.parcelStatus === "cancelled"
                ? deductPlanFallbackDeliveryFeeStatuses
                : deductFromSettlementDeliveryFeeStatuses;
    }
}

export function validateDeliveryFeeStatusForParcel(input: DeliveryFeeStatusValidationInput) {
    const allowedStatuses = getAllowedDeliveryFeeStatusesForParcel(input);

    if (allowedStatuses.includes(input.deliveryFeeStatus)) {
        return { ok: true as const };
    }

    const fieldName = input.fieldName ?? "deliveryFeeStatus";

    return {
        ok: false as const,
        message: "Delivery fee status does not match the delivery fee payment plan.",
        fieldErrors: createFieldErrors(
            fieldName,
            "Select a delivery fee status allowed for the current delivery fee payment plan.",
        ),
    };
}

export function normalizeParcelCorrectionState(
    input: ParcelCorrectionStateInput,
    prioritizedField?: keyof ParcelCorrectionState,
): ParcelCorrectionState {
    if (isValidCorrectionState(input)) {
        return {
            parcelStatus: input.parcelStatus,
            deliveryFeeStatus: input.deliveryFeeStatus,
            codStatus: input.codStatus,
            collectionStatus: input.collectionStatus,
        };
    }

    let bestMatch: ParcelCorrectionState | null = null;
    let bestScore = -1;

    for (const parcelStatus of PARCEL_STATUSES) {
        for (const deliveryFeeStatus of DELIVERY_FEE_STATUSES) {
            for (const codStatus of COD_STATUSES) {
                for (const collectionStatus of COLLECTION_STATUSES) {
                    const candidate = {
                        parcelStatus,
                        deliveryFeeStatus,
                        codStatus,
                        collectionStatus,
                    } satisfies ParcelCorrectionState;

                    if (
                        !isValidCorrectionState({
                            ...input,
                            ...candidate,
                        })
                    ) {
                        continue;
                    }

                    const prioritizedScore = getCorrectionStateScore(
                        input,
                        candidate,
                        prioritizedField,
                    );

                    if (prioritizedScore > bestScore) {
                        bestMatch = candidate;
                        bestScore = prioritizedScore;
                    }
                }
            }
        }
    }

    return (
        bestMatch ?? {
            parcelStatus: input.parcelStatus,
            deliveryFeeStatus: input.deliveryFeeStatus,
            codStatus: input.codStatus,
            collectionStatus: input.collectionStatus,
        }
    );
}

export function getParcelCorrectionOptions(
    input: ParcelCorrectionStateInput,
): ParcelCorrectionOptions {
    const normalizedState = normalizeParcelCorrectionState(input);
    const normalizedInput = {
        ...input,
        ...normalizedState,
    };

    return {
        parcelStatuses: PARCEL_STATUSES.filter((parcelStatus) =>
            isValidCorrectionState({
                ...normalizedInput,
                parcelStatus,
            }),
        ),
        deliveryFeeStatuses: DELIVERY_FEE_STATUSES.filter((deliveryFeeStatus) =>
            isValidCorrectionState({
                ...normalizedInput,
                deliveryFeeStatus,
            }),
        ),
        codStatuses: COD_STATUSES.filter((codStatus) =>
            isValidCorrectionState({
                ...normalizedInput,
                codStatus,
            }),
        ),
        collectionStatuses: COLLECTION_STATUSES.filter((collectionStatus) =>
            isValidCorrectionState({
                ...normalizedInput,
                collectionStatus,
            }),
        ),
    };
}
