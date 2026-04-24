import "server-only";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { validateParcelPaymentState } from "./payment-guardrails";
import { getMerchantSettlementBlockedReasons } from "@/features/merchant-settlements/server/settlement-calculations";
import { findMerchantProfileLinkByAppUserId } from "@/features/merchant/server/dal";
import {
    COD_STATUSES,
    COLLECTION_STATUSES,
    DELIVERY_FEE_PAYERS,
    DELIVERY_FEE_PAYMENT_PLANS,
    DELIVERY_FEE_STATUSES,
    MERCHANT_SETTLEMENT_STATUSES,
    PARCEL_STATUSES,
    PARCEL_TYPES,
    RIDER_PAYOUT_STATUSES,
    getDeliveryFeePaymentPlanOptions,
} from "@/features/parcels/constants";
import { getRiderById } from "@/features/rider/server/dal";
import { findTownshipById } from "@/features/townships/server/dal";
import { buildR2ObjectKey, getSignedR2ObjectUrl, uploadR2Object } from "@/lib/r2";
import { optionalNullableTrimmedString, optionalNullableUuid } from "@/lib/validation/zod-helpers";

export { validateParcelPaymentState };
export {
    COD_STATUSES,
    COLLECTION_STATUSES,
    DEFAULT_CREATE_PARCEL_STATE,
    DELIVERY_FEE_PAYERS,
    DELIVERY_FEE_PAYMENT_PLANS,
    DELIVERY_FEE_STATUSES,
    MERCHANT_SETTLEMENT_STATUSES,
    PARCEL_STATUSES,
    PARCEL_TYPES,
    RIDER_PAYOUT_STATUSES,
    getDeliveryFeePaymentPlanOptions,
} from "@/features/parcels/constants";

export const PARCEL_IMAGE_MAX_FILES = 5;
export const PARCEL_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;

const PARCEL_IMAGE_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const CREATE_PARCEL_FORM_FIELDS = [
    "merchantId",
    "riderId",
    "recipientName",
    "recipientPhone",
    "recipientTownshipId",
    "recipientAddress",
    "parcelDescription",
    "packageCount",
    "specialHandlingNote",
    "estimatedWeightKg",
    "packageWidthCm",
    "packageHeightCm",
    "packageLengthCm",
    "parcelType",
    "codAmount",
    "deliveryFee",
    "deliveryFeePayer",
    "deliveryFeePaymentPlan",
    "paymentNote",
] as const;
const UPDATE_PARCEL_FORM_FIELDS = [
    "parcelId",
    "merchantId",
    "riderId",
    "recipientName",
    "recipientPhone",
    "recipientTownshipId",
    "recipientAddress",
    "parcelDescription",
    "packageCount",
    "specialHandlingNote",
    "estimatedWeightKg",
    "packageWidthCm",
    "packageHeightCm",
    "packageLengthCm",
    "parcelType",
    "codAmount",
    "deliveryFee",
    "deliveryFeePayer",
    "deliveryFeePaymentPlan",
    "paymentNote",
    "parcelStatus",
    "deliveryFeeStatus",
    "codStatus",
    "collectionStatus",
    "collectedAmount",
] as const;
const UPDATE_PARCEL_DETAIL_FORM_FIELDS = [
    "parcelId",
    "merchantId",
    "riderId",
    "recipientName",
    "recipientPhone",
    "recipientTownshipId",
    "recipientAddress",
    "parcelDescription",
    "packageCount",
    "specialHandlingNote",
    "estimatedWeightKg",
    "packageWidthCm",
    "packageHeightCm",
    "packageLengthCm",
    "parcelType",
    "codAmount",
    "deliveryFee",
    "deliveryFeePayer",
    "deliveryFeePaymentPlan",
] as const;
const RIDER_PARCEL_IMAGE_UPLOAD_FIELDS = ["parcelId"] as const;
const PARCEL_IMAGE_FIELD_NAMES = [
    "pickupImages",
    "proofOfDeliveryImages",
    "paymentSlipImages",
] as const;
const parcelImageFieldLabels: Record<ParcelImageFieldName, string> = {
    pickupImages: "Pickup images",
    proofOfDeliveryImages: "Proof of delivery images",
    paymentSlipImages: "Payment slip images",
};

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

const optionalDecimalField = z
    .preprocess((value) => {
        if (typeof value === "number") {
            return value;
        }

        if (typeof value !== "string") {
            return undefined;
        }

        const normalized = value.trim();

        if (!normalized) {
            return undefined;
        }

        return Number(normalized);
    }, z.number().finite().min(0).max(999999999).optional())
    .transform((value) => value ?? null);

const positiveIntegerField = z.preprocess((value) => {
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
}, z.number().int().min(1).max(9999));

const optionalNullableDeliveryFeePaymentPlanField = z
    .preprocess((value) => {
        if (typeof value !== "string") {
            return value;
        }

        const normalized = value.trim();

        if (!normalized) {
            return undefined;
        }

        return normalized;
    }, z.enum(DELIVERY_FEE_PAYMENT_PLANS).optional())
    .transform((value) => value ?? null);

export const createParcelSchema = z.object({
    merchantId: z.string().trim().uuid(),
    riderId: optionalNullableUuid(),
    recipientName: z.string().trim().min(2).max(120),
    recipientPhone: z.string().trim().min(6).max(30),
    recipientTownshipId: z.string().trim().uuid(),
    recipientAddress: z.string().trim().min(3).max(255),
    parcelDescription: z.string().trim().min(1).max(2000),
    packageCount: positiveIntegerField,
    specialHandlingNote: optionalNullableTrimmedString(1000),
    estimatedWeightKg: optionalDecimalField,
    packageWidthCm: optionalDecimalField,
    packageHeightCm: optionalDecimalField,
    packageLengthCm: optionalDecimalField,
    parcelType: z.enum(PARCEL_TYPES),
    codAmount: moneyField,
    deliveryFee: moneyField,
    deliveryFeePayer: z.enum(DELIVERY_FEE_PAYERS),
    deliveryFeePaymentPlan: z.enum(DELIVERY_FEE_PAYMENT_PLANS),
    paymentNote: optionalNullableTrimmedString(1000),
});

export const updateParcelSchema = createParcelSchema.extend({
    deliveryFeePaymentPlan: optionalNullableDeliveryFeePaymentPlanField,
    parcelId: z.string().trim().uuid(),
    parcelStatus: z.enum(PARCEL_STATUSES),
    deliveryFeeStatus: z.enum(DELIVERY_FEE_STATUSES),
    codStatus: z.enum(COD_STATUSES),
    collectionStatus: z.enum(COLLECTION_STATUSES),
    collectedAmount: moneyField,
});

export const updateParcelDetailSchema = createParcelSchema.omit({ paymentNote: true }).extend({
    deliveryFeePaymentPlan: optionalNullableDeliveryFeePaymentPlanField,
    parcelId: z.string().trim().uuid(),
});

export const advanceRiderParcelSchema = z.object({
    parcelId: z.string().trim().uuid(),
    nextStatus: z.enum(PARCEL_STATUSES),
});
export const riderParcelImageUploadSchema = z.object({
    parcelId: z.string().trim().uuid(),
});
export const parcelIdActionSchema = z.object({
    parcelId: z.string().trim().uuid(),
});
export const advanceOfficeParcelStatusSchema = parcelIdActionSchema.extend({
    nextStatus: z.enum(PARCEL_STATUSES),
});
export const resolveParcelDeliveryFeeSchema = parcelIdActionSchema.extend({
    deliveryFeeStatus: z.enum(DELIVERY_FEE_STATUSES),
    paymentNote: optionalNullableTrimmedString(1000),
});
export const adminCorrectParcelStateSchema = parcelIdActionSchema.extend({
    parcelStatus: z.enum(PARCEL_STATUSES),
    deliveryFeeStatus: z.enum(DELIVERY_FEE_STATUSES),
    codStatus: z.enum(COD_STATUSES),
    collectionStatus: z.enum(COLLECTION_STATUSES),
    collectedAmount: moneyField,
    paymentNote: optionalNullableTrimmedString(1000),
    correctionNote: z.string().trim().min(3).max(1000),
});

export type ParcelCreateInput = z.infer<typeof createParcelSchema>;
export type ParcelUpdateInput = z.infer<typeof updateParcelSchema>;
export type ParcelDetailUpdateInput = z.infer<typeof updateParcelDetailSchema>;
export type ParcelFormFields = Record<(typeof UPDATE_PARCEL_FORM_FIELDS)[number], string>;
export type ParcelImageFieldName = (typeof PARCEL_IMAGE_FIELD_NAMES)[number];
export type ParcelMediaFiles = Record<ParcelImageFieldName, File[]>;
export type ParcelFieldErrors = Partial<Record<string, string[]>>;
export type ParcelImageAsset = {
    key: string;
    url: string;
};
export type ParcelListQuery = {
    query: string;
    page: number;
    pageSize: number;
    parcelStatus: (typeof PARCEL_STATUSES)[number] | null;
    codStatus: (typeof COD_STATUSES)[number] | null;
    collectionStatus: (typeof COLLECTION_STATUSES)[number] | null;
    deliveryFeeStatus: (typeof DELIVERY_FEE_STATUSES)[number] | null;
    merchantSettlementStatus: (typeof MERCHANT_SETTLEMENT_STATUSES)[number] | null;
};
export type ParcelWriteValues = {
    merchantId: string;
    riderId: string | null;
    recipientName: string;
    recipientPhone: string;
    recipientTownshipId: string;
    recipientAddress: string;
    parcelDescription: string;
    packageCount: number;
    specialHandlingNote: string | null;
    estimatedWeightKg: string | null;
    packageWidthCm: string | null;
    packageHeightCm: string | null;
    packageLengthCm: string | null;
    parcelType: "cod" | "non_cod";
    codAmount: string;
    deliveryFee: string;
    totalAmountToCollect: string;
    deliveryFeePayer: "merchant" | "receiver";
    deliveryFeePaymentPlan: (typeof DELIVERY_FEE_PAYMENT_PLANS)[number] | null;
    pickupImageKeys: string[];
    proofOfDeliveryImageKeys: string[];
    status: (typeof PARCEL_STATUSES)[number];
};
export type ParcelPaymentWriteValues = {
    deliveryFeeStatus: (typeof DELIVERY_FEE_STATUSES)[number];
    codStatus: (typeof COD_STATUSES)[number];
    collectedAmount: string;
    collectionStatus: (typeof COLLECTION_STATUSES)[number];
    merchantSettlementStatus: (typeof MERCHANT_SETTLEMENT_STATUSES)[number];
    riderPayoutStatus: (typeof RIDER_PAYOUT_STATUSES)[number];
    note: string | null;
    paymentSlipImageKeys: string[];
};

export const PARCEL_LIST_PAGE_SIZE = 25;

type ParcelListSearchParams = Record<string, string | string[] | undefined>;

type ParcelFormParseSuccess<T> = {
    ok: true;
    data: T;
    fields: Record<string, string>;
    files: ParcelMediaFiles;
};

type ParcelFormParseFailure = {
    ok: false;
    message: string;
    fields: Record<string, string>;
    fieldErrors?: ParcelFieldErrors;
};

export type RiderNextAction = {
    label: string;
    nextStatus: (typeof PARCEL_STATUSES)[number];
};
export type OfficeParcelMovementAction = {
    label: string;
    nextStatus: (typeof PARCEL_STATUSES)[number];
};
export type ParcelOperationTone = "muted" | "info" | "success" | "warning" | "danger";
export type ParcelOperationState = {
    label: string;
    tone: ParcelOperationTone;
};
export type ParcelOperationInput = {
    parcelType: (typeof PARCEL_TYPES)[number];
    parcelStatus: (typeof PARCEL_STATUSES)[number];
    codAmount: string | number;
    deliveryFee: string | number;
    totalAmountToCollect?: string | number;
    deliveryFeePayer: (typeof DELIVERY_FEE_PAYERS)[number];
    deliveryFeeStatus: (typeof DELIVERY_FEE_STATUSES)[number];
    codStatus: (typeof COD_STATUSES)[number];
    collectedAmount?: string | number;
    collectionStatus: (typeof COLLECTION_STATUSES)[number];
    merchantSettlementStatus: (typeof MERCHANT_SETTLEMENT_STATUSES)[number];
    merchantSettlementId: string | null;
    paymentNote?: string | null;
};
export type ParcelOperationSummary = {
    movementActions: OfficeParcelMovementAction[];
    cash: ParcelOperationState & {
        canReceiveAtOffice: boolean;
    };
    deliveryFee: ParcelOperationState & {
        canResolve: boolean;
        resolutionOptions: (typeof DELIVERY_FEE_STATUSES)[number][];
    };
    settlement: ParcelOperationState & {
        blockedReasons: string[];
    };
    primaryActionLabel: string;
};

function getSearchParamValue(searchParams: ParcelListSearchParams, key: string) {
    const value = searchParams[key];

    if (Array.isArray(value)) {
        return value[0] ?? "";
    }

    return value ?? "";
}

function normalizeParcelSearchQuery(raw: string | undefined) {
    return raw?.trim().replaceAll("%", "").replaceAll("_", "").trim() ?? "";
}

function parseParcelListPage(raw: string | undefined) {
    const page = Number(raw);

    if (!Number.isSafeInteger(page) || page < 1) {
        return 1;
    }

    return page;
}

function isAllowedValue<TValues extends readonly string[]>(
    values: TValues,
    value: string,
): value is TValues[number] {
    return values.includes(value);
}

function parseNullableEnumValue<TValues extends readonly string[]>(
    raw: string | undefined,
    values: TValues,
) {
    const value = raw?.trim() ?? "";

    if (!value || !isAllowedValue(values, value)) {
        return null;
    }

    return value;
}

export function getDefaultParcelListQuery(): ParcelListQuery {
    return {
        query: "",
        page: 1,
        pageSize: PARCEL_LIST_PAGE_SIZE,
        parcelStatus: null,
        codStatus: null,
        collectionStatus: null,
        deliveryFeeStatus: null,
        merchantSettlementStatus: null,
    };
}

export function normalizeParcelListQueryParams(
    searchParams: ParcelListSearchParams,
    options: {
        includeInternalPaymentFilters?: boolean;
    } = {},
): ParcelListQuery {
    const includeInternalPaymentFilters = options.includeInternalPaymentFilters ?? true;

    return {
        query: normalizeParcelSearchQuery(getSearchParamValue(searchParams, "q")),
        page: parseParcelListPage(getSearchParamValue(searchParams, "page")),
        pageSize: PARCEL_LIST_PAGE_SIZE,
        parcelStatus: parseNullableEnumValue(
            getSearchParamValue(searchParams, "parcelStatus"),
            PARCEL_STATUSES,
        ),
        codStatus: parseNullableEnumValue(
            getSearchParamValue(searchParams, "codStatus"),
            COD_STATUSES,
        ),
        collectionStatus: includeInternalPaymentFilters
            ? parseNullableEnumValue(
                  getSearchParamValue(searchParams, "collectionStatus"),
                  COLLECTION_STATUSES,
              )
            : null,
        deliveryFeeStatus: includeInternalPaymentFilters
            ? parseNullableEnumValue(
                  getSearchParamValue(searchParams, "deliveryFeeStatus"),
                  DELIVERY_FEE_STATUSES,
              )
            : null,
        merchantSettlementStatus: parseNullableEnumValue(
            getSearchParamValue(searchParams, "merchantSettlementStatus"),
            MERCHANT_SETTLEMENT_STATUSES,
        ),
    };
}

export function hasActiveParcelListFilters(input: ParcelListQuery) {
    return Boolean(
        input.query ||
        input.parcelStatus ||
        input.codStatus ||
        input.collectionStatus ||
        input.deliveryFeeStatus ||
        input.merchantSettlementStatus,
    );
}

export function toParcelSearchPattern(query: string) {
    const normalizedQuery = normalizeParcelSearchQuery(query);

    return normalizedQuery ? `%${normalizedQuery}%` : "";
}

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

const officeMovementActionsByStatus: Partial<
    Record<(typeof PARCEL_STATUSES)[number], OfficeParcelMovementAction[]>
> = {
    pending: [{ label: "Start Pickup", nextStatus: "out_for_pickup" }],
    out_for_pickup: [{ label: "Mark At Office", nextStatus: "at_office" }],
    at_office: [{ label: "Start Delivery", nextStatus: "out_for_delivery" }],
    out_for_delivery: [
        { label: "Mark Delivered", nextStatus: "delivered" },
        { label: "Return To Office", nextStatus: "return_to_office" },
    ],
    return_to_office: [{ label: "Return To Merchant", nextStatus: "return_to_merchant" }],
    return_to_merchant: [{ label: "Mark Returned", nextStatus: "returned" }],
};

export function isParcelSettlementLocked(input: {
    merchantSettlementStatus: (typeof MERCHANT_SETTLEMENT_STATUSES)[number];
    merchantSettlementId: string | null;
}) {
    return input.merchantSettlementStatus !== "pending" || Boolean(input.merchantSettlementId);
}

export function getOfficeParcelMovementActions(
    parcel: Pick<
        ParcelOperationInput,
        "parcelStatus" | "merchantSettlementStatus" | "merchantSettlementId"
    >,
): OfficeParcelMovementAction[] {
    if (isParcelSettlementLocked(parcel)) {
        return [];
    }

    return officeMovementActionsByStatus[parcel.parcelStatus] ?? [];
}

function canUseDeliveryFeeResolution(
    parcel: ParcelOperationInput,
    deliveryFeeStatus: (typeof DELIVERY_FEE_STATUSES)[number],
) {
    if (
        deliveryFeeStatus === "unpaid" ||
        deliveryFeeStatus === parcel.deliveryFeeStatus ||
        isParcelSettlementLocked(parcel)
    ) {
        return false;
    }

    return validateParcelPaymentState({
        parcelType: parcel.parcelType,
        parcelStatus: parcel.parcelStatus,
        deliveryFeePayer: parcel.deliveryFeePayer,
        codAmount: Number(parcel.codAmount),
        deliveryFee: Number(parcel.deliveryFee),
        deliveryFeeStatus,
        previousDeliveryFeeStatus: parcel.deliveryFeeStatus,
        codStatus: parcel.codStatus,
        collectionStatus: parcel.collectionStatus,
        merchantSettlementStatus: parcel.merchantSettlementStatus,
        merchantSettlementId: parcel.merchantSettlementId,
        paymentNote:
            deliveryFeeStatus === "waived"
                ? (parcel.paymentNote ?? "Delivery fee waived by office.")
                : (parcel.paymentNote ?? null),
    }).ok;
}

export function getDeliveryFeeResolutionOptions(
    parcel: ParcelOperationInput,
): (typeof DELIVERY_FEE_STATUSES)[number][] {
    if (parcel.deliveryFeeStatus !== "unpaid" || Number(parcel.deliveryFee) <= 0) {
        return [];
    }

    const candidateStatuses =
        parcel.deliveryFeePayer === "merchant"
            ? (["paid_by_merchant", "deduct_from_settlement", "bill_merchant", "waived"] as const)
            : (["collected_from_receiver", "waived"] as const);

    return candidateStatuses.filter((status) => canUseDeliveryFeeResolution(parcel, status));
}

export function canReceiveParcelCashAtOffice(parcel: ParcelOperationInput) {
    return (
        !isParcelSettlementLocked(parcel) &&
        parcel.parcelType === "cod" &&
        parcel.parcelStatus === "delivered" &&
        parcel.codStatus === "collected" &&
        parcel.collectionStatus === "collected_by_rider"
    );
}

export function getParcelOperationBlockedReasons(parcel: ParcelOperationInput) {
    if (parcel.parcelType !== "cod") {
        return [];
    }

    return getMerchantSettlementBlockedReasons({
        parcelStatus: parcel.parcelStatus,
        codStatus: parcel.codStatus,
        codAmount: String(parcel.codAmount),
        deliveryFee: String(parcel.deliveryFee),
        collectionStatus: parcel.collectionStatus,
        deliveryFeePayer: parcel.deliveryFeePayer,
        deliveryFeeStatus: parcel.deliveryFeeStatus,
        merchantSettlementStatus: parcel.merchantSettlementStatus,
        merchantSettlementId: parcel.merchantSettlementId,
    });
}

function getCashOperationState(parcel: ParcelOperationInput): ParcelOperationSummary["cash"] {
    if (parcel.parcelType !== "cod") {
        return { label: "No COD", tone: "muted", canReceiveAtOffice: false };
    }

    if (parcel.collectionStatus === "received_by_office") {
        return { label: "Cash at office", tone: "success", canReceiveAtOffice: false };
    }

    if (canReceiveParcelCashAtOffice(parcel)) {
        return { label: "Receive rider cash", tone: "warning", canReceiveAtOffice: true };
    }

    if (parcel.collectionStatus === "collected_by_rider") {
        return { label: "Held by rider", tone: "info", canReceiveAtOffice: false };
    }

    if (parcel.codStatus === "not_collected" || parcel.collectionStatus === "not_collected") {
        return { label: "COD not collected", tone: "danger", canReceiveAtOffice: false };
    }

    return { label: "Cash pending", tone: "warning", canReceiveAtOffice: false };
}

function getDeliveryFeeOperationState(
    parcel: ParcelOperationInput,
    resolutionOptions: (typeof DELIVERY_FEE_STATUSES)[number][],
): ParcelOperationSummary["deliveryFee"] {
    if (Number(parcel.deliveryFee) <= 0) {
        return {
            label: "No fee",
            tone: "muted",
            canResolve: false,
            resolutionOptions,
        };
    }

    if (parcel.deliveryFeeStatus === "unpaid" && resolutionOptions.length > 0) {
        return {
            label: "Resolve fee",
            tone: "warning",
            canResolve: true,
            resolutionOptions,
        };
    }

    if (parcel.deliveryFeeStatus === "unpaid") {
        return {
            label: "Fee unresolved",
            tone: "warning",
            canResolve: false,
            resolutionOptions,
        };
    }

    return {
        label: "Fee resolved",
        tone: "success",
        canResolve: false,
        resolutionOptions,
    };
}

function getSettlementOperationState(
    parcel: ParcelOperationInput,
    blockedReasons: string[],
): ParcelOperationSummary["settlement"] {
    if (parcel.parcelType !== "cod") {
        return { label: "No COD settlement", tone: "muted", blockedReasons };
    }

    if (parcel.merchantSettlementStatus === "settled") {
        return { label: "Settled", tone: "success", blockedReasons };
    }

    if (isParcelSettlementLocked(parcel)) {
        return { label: "Locked by settlement", tone: "info", blockedReasons };
    }

    if (blockedReasons.length === 0) {
        return { label: "Settlement ready", tone: "success", blockedReasons };
    }

    return { label: "Settlement blocked", tone: "warning", blockedReasons };
}

export function getParcelOperationSummary(parcel: ParcelOperationInput): ParcelOperationSummary {
    const movementActions = getOfficeParcelMovementActions(parcel);
    const resolutionOptions = getDeliveryFeeResolutionOptions(parcel);
    const blockedReasons = getParcelOperationBlockedReasons(parcel);
    const cash = getCashOperationState(parcel);
    const deliveryFee = getDeliveryFeeOperationState(parcel, resolutionOptions);
    const settlement = getSettlementOperationState(parcel, blockedReasons);
    const primaryActionLabel = cash.canReceiveAtOffice
        ? "Receive Cash"
        : deliveryFee.canResolve
          ? "Resolve Fee"
          : movementActions.length === 1
            ? movementActions[0].label
            : movementActions.length > 1
              ? "Open Operations"
              : "View Parcel";

    return {
        movementActions,
        cash,
        deliveryFee,
        settlement,
        primaryActionLabel,
    };
}

function getStringFieldValue(formData: FormData, key: string) {
    const value = formData.get(key);

    return typeof value === "string" ? value : "";
}

function getScalarFields<TFieldName extends string>(
    formData: FormData,
    fieldNames: readonly TFieldName[],
) {
    return Object.fromEntries(
        fieldNames.map((fieldName) => [fieldName, getStringFieldValue(formData, fieldName)]),
    ) as Record<TFieldName, string>;
}

function toFieldErrors(fieldErrors: Record<string, string[] | undefined>) {
    return Object.fromEntries(
        Object.entries(fieldErrors).filter(([, value]) => value !== undefined && value.length > 0),
    ) as ParcelFieldErrors;
}

function createFieldErrors(fieldName: string, message: string): ParcelFieldErrors {
    return {
        [fieldName]: [message],
    };
}

export function validateDeliveryFeePaymentPlan(input: {
    parcelType: (typeof PARCEL_TYPES)[number];
    deliveryFeePayer: (typeof DELIVERY_FEE_PAYERS)[number];
    deliveryFeePaymentPlan: (typeof DELIVERY_FEE_PAYMENT_PLANS)[number] | null;
    requireRecordedPlan?: boolean;
}) {
    if (!input.deliveryFeePaymentPlan) {
        return input.requireRecordedPlan
            ? {
                  ok: false as const,
                  message: "Delivery fee payment plan is required.",
                  fieldErrors: createFieldErrors(
                      "deliveryFeePaymentPlan",
                      "Select a delivery fee payment plan.",
                  ),
              }
            : { ok: true as const };
    }

    const options = getDeliveryFeePaymentPlanOptions({
        parcelType: input.parcelType,
        deliveryFeePayer: input.deliveryFeePayer,
    });

    if (!options.includes(input.deliveryFeePaymentPlan)) {
        return {
            ok: false as const,
            message: "Delivery fee payment plan does not match the fee payer and parcel type.",
            fieldErrors: createFieldErrors(
                "deliveryFeePaymentPlan",
                "Select a valid delivery fee payment plan.",
            ),
        };
    }

    return { ok: true as const };
}

export function validateCreateParcelMedia(input: {
    deliveryFeePaymentPlan: (typeof DELIVERY_FEE_PAYMENT_PLANS)[number];
    files: ParcelMediaFiles;
}) {
    if (input.files.pickupImages.length > 0) {
        return {
            ok: false as const,
            message: "Pickup images cannot be uploaded during parcel create.",
            fieldErrors: createFieldErrors(
                "pickupImages",
                "Upload pickup images after pickup starts.",
            ),
        };
    }

    if (input.files.proofOfDeliveryImages.length > 0) {
        return {
            ok: false as const,
            message: "Proof of delivery images cannot be uploaded during parcel create.",
            fieldErrors: createFieldErrors(
                "proofOfDeliveryImages",
                "Upload proof of delivery images after delivery.",
            ),
        };
    }

    return validatePaymentSlipImagesForPlan({
        deliveryFeePaymentPlan: input.deliveryFeePaymentPlan,
        paymentSlipImages: input.files.paymentSlipImages,
    });
}

export function validatePaymentSlipImagesForPlan(input: {
    deliveryFeePaymentPlan: (typeof DELIVERY_FEE_PAYMENT_PLANS)[number] | null;
    paymentSlipImages: File[];
}) {
    if (
        input.paymentSlipImages.length > 0 &&
        input.deliveryFeePaymentPlan !== "merchant_prepaid_bank_transfer"
    ) {
        return {
            ok: false as const,
            message: "Payment slip images are only allowed for merchant prepaid bank transfer.",
            fieldErrors: createFieldErrors(
                "paymentSlipImages",
                "Payment slips are only allowed for prepaid bank transfer.",
            ),
        };
    }

    return { ok: true as const };
}

function getParcelMediaFiles(formData: FormData): ParcelMediaFiles {
    return {
        pickupImages: formData
            .getAll("pickupImages")
            .filter(
                (value): value is File =>
                    value instanceof File && value.size > 0 && value.name !== "",
            ),
        proofOfDeliveryImages: formData
            .getAll("proofOfDeliveryImages")
            .filter(
                (value): value is File =>
                    value instanceof File && value.size > 0 && value.name !== "",
            ),
        paymentSlipImages: formData
            .getAll("paymentSlipImages")
            .filter(
                (value): value is File =>
                    value instanceof File && value.size > 0 && value.name !== "",
            ),
    };
}

export function validateParcelMediaFiles(files: ParcelMediaFiles) {
    for (const fieldName of PARCEL_IMAGE_FIELD_NAMES) {
        const fieldFiles = files[fieldName];

        if (fieldFiles.length > PARCEL_IMAGE_MAX_FILES) {
            return {
                ok: false as const,
                message: `${parcelImageFieldLabels[fieldName]} can include up to ${PARCEL_IMAGE_MAX_FILES} files.`,
                fieldErrors: createFieldErrors(
                    fieldName,
                    `You can upload up to ${PARCEL_IMAGE_MAX_FILES} files.`,
                ),
            };
        }

        for (const file of fieldFiles) {
            if (!PARCEL_IMAGE_ALLOWED_TYPES.has(file.type)) {
                return {
                    ok: false as const,
                    message: `${parcelImageFieldLabels[fieldName]} must be JPG, PNG, or WebP.`,
                    fieldErrors: createFieldErrors(
                        fieldName,
                        "Only JPG, PNG, or WebP files are allowed.",
                    ),
                };
            }

            if (file.size > PARCEL_IMAGE_MAX_SIZE_BYTES) {
                return {
                    ok: false as const,
                    message: `${parcelImageFieldLabels[fieldName]} must be 5 MB or smaller.`,
                    fieldErrors: createFieldErrors(fieldName, "Each file must be 5 MB or smaller."),
                };
            }
        }
    }

    return { ok: true as const };
}

function parseParcelFormData<TSchema extends z.ZodTypeAny>(
    formData: FormData,
    schema: TSchema,
    fieldNames: readonly string[],
): ParcelFormParseSuccess<z.infer<TSchema>> | ParcelFormParseFailure {
    const fields = getScalarFields(formData, fieldNames);
    const files = getParcelMediaFiles(formData);
    const mediaValidation = validateParcelMediaFiles(files);

    if (!mediaValidation.ok) {
        return {
            ok: false,
            message: mediaValidation.message,
            fields,
            fieldErrors: mediaValidation.fieldErrors,
        };
    }

    const parsed = schema.safeParse(fields);

    if (!parsed.success) {
        return {
            ok: false,
            message: "Please correct the highlighted fields.",
            fields,
            fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
        };
    }

    return {
        ok: true,
        data: parsed.data,
        fields,
        files,
    };
}

export function parseCreateParcelFormData(formData: FormData) {
    return parseParcelFormData(formData, createParcelSchema, CREATE_PARCEL_FORM_FIELDS);
}

export function parseUpdateParcelFormData(formData: FormData) {
    return parseParcelFormData(formData, updateParcelSchema, UPDATE_PARCEL_FORM_FIELDS);
}

export function parseUpdateParcelDetailFormData(formData: FormData) {
    return parseParcelFormData(
        formData,
        updateParcelDetailSchema,
        UPDATE_PARCEL_DETAIL_FORM_FIELDS,
    );
}

export function parseRiderParcelImageUploadFormData(formData: FormData) {
    return parseParcelFormData(
        formData,
        riderParcelImageUploadSchema,
        RIDER_PARCEL_IMAGE_UPLOAD_FIELDS,
    );
}

export function validateParcelImageAppendLimits(input: {
    currentPickupImageCount: number;
    currentProofOfDeliveryImageCount: number;
    currentPaymentSlipImageCount: number;
    files: ParcelMediaFiles;
}) {
    const nextCounts: Record<ParcelImageFieldName, number> = {
        pickupImages: input.currentPickupImageCount + input.files.pickupImages.length,
        proofOfDeliveryImages:
            input.currentProofOfDeliveryImageCount + input.files.proofOfDeliveryImages.length,
        paymentSlipImages:
            input.currentPaymentSlipImageCount + input.files.paymentSlipImages.length,
    };

    for (const fieldName of PARCEL_IMAGE_FIELD_NAMES) {
        if (nextCounts[fieldName] > PARCEL_IMAGE_MAX_FILES) {
            return {
                ok: false as const,
                message: `${parcelImageFieldLabels[fieldName]} can include up to ${PARCEL_IMAGE_MAX_FILES} files in total.`,
                fieldErrors: createFieldErrors(
                    fieldName,
                    `This parcel can have up to ${PARCEL_IMAGE_MAX_FILES} files in total.`,
                ),
            };
        }
    }

    return { ok: true as const };
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

export function toOptionalMoneyString(value: number | null) {
    return value === null ? null : toMoneyString(value);
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

export function buildParcelWriteValues(input: {
    data: ParcelCreateInput | ParcelUpdateInput | ParcelDetailUpdateInput;
    merchantId: string;
    riderId: string | null;
    totalAmountToCollect: number;
    deliveryFeePaymentPlan: (typeof DELIVERY_FEE_PAYMENT_PLANS)[number] | null;
    parcelStatus: (typeof PARCEL_STATUSES)[number];
    pickupImageKeys: string[];
    proofOfDeliveryImageKeys: string[];
}) {
    return {
        merchantId: input.merchantId,
        riderId: input.riderId,
        recipientName: input.data.recipientName,
        recipientPhone: input.data.recipientPhone,
        recipientTownshipId: input.data.recipientTownshipId,
        recipientAddress: input.data.recipientAddress,
        parcelDescription: input.data.parcelDescription,
        packageCount: input.data.packageCount,
        specialHandlingNote: input.data.specialHandlingNote,
        estimatedWeightKg: toOptionalMoneyString(input.data.estimatedWeightKg),
        packageWidthCm: toOptionalMoneyString(input.data.packageWidthCm),
        packageHeightCm: toOptionalMoneyString(input.data.packageHeightCm),
        packageLengthCm: toOptionalMoneyString(input.data.packageLengthCm),
        parcelType: input.data.parcelType,
        codAmount: toMoneyString(input.data.parcelType === "cod" ? input.data.codAmount : 0),
        deliveryFee: toMoneyString(input.data.deliveryFee),
        totalAmountToCollect: toMoneyString(input.totalAmountToCollect),
        deliveryFeePayer: input.data.deliveryFeePayer,
        deliveryFeePaymentPlan: input.deliveryFeePaymentPlan,
        pickupImageKeys: input.pickupImageKeys,
        proofOfDeliveryImageKeys: input.proofOfDeliveryImageKeys,
        status: input.parcelStatus,
    } satisfies ParcelWriteValues;
}

export function buildParcelPaymentWriteValues(input: {
    deliveryFeeStatus: (typeof DELIVERY_FEE_STATUSES)[number];
    codStatus: (typeof COD_STATUSES)[number];
    collectedAmount: number;
    collectionStatus: (typeof COLLECTION_STATUSES)[number];
    merchantSettlementStatus: (typeof MERCHANT_SETTLEMENT_STATUSES)[number];
    riderPayoutStatus: (typeof RIDER_PAYOUT_STATUSES)[number];
    paymentNote: string | null;
    paymentSlipImageKeys: string[];
}) {
    return {
        deliveryFeeStatus: input.deliveryFeeStatus,
        codStatus: input.codStatus,
        collectedAmount: toMoneyString(input.collectedAmount),
        collectionStatus: input.collectionStatus,
        merchantSettlementStatus: input.merchantSettlementStatus,
        riderPayoutStatus: input.riderPayoutStatus,
        note: input.paymentNote,
        paymentSlipImageKeys: input.paymentSlipImageKeys,
    } satisfies ParcelPaymentWriteValues;
}

export function mergeParcelImageKeys(existingKeys: string[], uploadedKeys: string[]) {
    if (uploadedKeys.length === 0) {
        return existingKeys;
    }

    return [...existingKeys, ...uploadedKeys];
}

export async function uploadParcelMediaFiles(input: {
    parcelCode: string;
    files: ParcelMediaFiles;
}) {
    const uploadGroup = async (category: string, files: File[]) => {
        return Promise.all(
            files.map(async (file) => {
                const key = buildR2ObjectKey({
                    scope: input.parcelCode,
                    category,
                    originalFileName: file.name,
                });

                return uploadR2Object({ key, file });
            }),
        );
    };

    const [pickupImageKeys, proofOfDeliveryImageKeys, paymentSlipImageKeys] = await Promise.all([
        uploadGroup("pickup", input.files.pickupImages),
        uploadGroup("proof-of-delivery", input.files.proofOfDeliveryImages),
        uploadGroup("payment-slip", input.files.paymentSlipImages),
    ]);

    return {
        pickupImageKeys,
        proofOfDeliveryImageKeys,
        paymentSlipImageKeys,
    };
}

export async function signParcelImageKeys(keys: string[]): Promise<ParcelImageAsset[]> {
    return Promise.all(
        keys.map(async (key) => ({
            key,
            url: await getSignedR2ObjectUrl(key),
        })),
    );
}

export function normalizePatchValue(value: unknown) {
    return Array.isArray(value) ? JSON.stringify(value) : value;
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
    deliveryFeePayer: (typeof DELIVERY_FEE_PAYERS)[number];
    deliveryFeeStatus?: (typeof DELIVERY_FEE_STATUSES)[number];
    deliveryFeePaymentPlan?: (typeof DELIVERY_FEE_PAYMENT_PLANS)[number] | null;
    requireRecordedDeliveryFeePaymentPlan?: boolean;
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

    if (input.deliveryFeePaymentPlan !== undefined) {
        const deliveryFeePaymentPlanGuard = validateDeliveryFeePaymentPlan({
            parcelType: input.parcelType,
            deliveryFeePayer: input.deliveryFeePayer,
            deliveryFeePaymentPlan: input.deliveryFeePaymentPlan,
            requireRecordedPlan: input.requireRecordedDeliveryFeePaymentPlan ?? false,
        });

        if (!deliveryFeePaymentPlanGuard.ok) {
            return deliveryFeePaymentPlanGuard;
        }
    }

    return validateUpdateCodState({
        parcelType: input.parcelType,
        codStatus: input.codStatus,
    });
}
