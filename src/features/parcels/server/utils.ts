import "server-only";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { merchantContactReferenceSchema } from "@/features/merchant-contacts/server/utils";
import { findMerchantPickupLocationById } from "@/features/merchant-pickup-locations/server/dal";
import { pickupLocationReferenceSchema } from "@/features/merchant-pickup-locations/server/utils";
import { getMerchantSettlementBlockedReasons } from "@/features/merchant-settlements/server/settlement-calculations";
import { findMerchantProfileLinkByAppUserId } from "@/features/merchant/server/dal";
import {
    COD_STATUSES,
    COLLECTION_STATUSES,
    CREATE_PARCEL_MAX_ROWS,
    DELIVERY_FEE_PAYERS,
    DELIVERY_FEE_PAYMENT_PLANS,
    DELIVERY_FEE_STATUSES,
    MERCHANT_SETTLEMENT_STATUSES,
    PARCEL_STATUSES,
    PARCEL_TYPES,
    RIDER_PAYOUT_STATUSES,
    getDeliveryFeePaymentPlanOptions,
} from "@/features/parcels/constants";
import {
    getAllowedDeliveryFeeStatusesForParcel,
    validateDeliveryFeeStatusForParcel,
    validateParcelPaymentState,
} from "@/features/parcels/payment-state";
import { getRiderById } from "@/features/rider/server/dal";
import { findTownshipById } from "@/features/townships/server/dal";
import { buildR2ObjectKey, getSignedR2ObjectUrl, uploadR2Object } from "@/lib/r2";
import { optionalNullableTrimmedString, optionalNullableUuid } from "@/lib/validation/zod-helpers";

export {
    getAllowedDeliveryFeeStatusesForParcel,
    validateDeliveryFeeStatusForParcel,
    validateParcelPaymentState,
};
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
const CREATE_PARCEL_SHARED_FORM_FIELDS = [
    "merchantId",
    "riderId",
    "pickupLocationId",
    "pickupLocationLabel",
    "pickupTownshipId",
    "pickupAddress",
    "savePickupLocation",
    "selectedMerchantContactId",
    "contactLabel",
    "saveRecipientContact",
    "recipientName",
    "recipientPhone",
    "recipientTownshipId",
    "recipientAddress",
    "deliveryFeePayer",
    "deliveryFeePaymentPlan",
    "paymentNote",
] as const;
const CREATE_PARCEL_ROW_FIELDS = [
    "parcelDescription",
    "packageCount",
    "specialHandlingNote",
    "estimatedWeightKg",
    "isLargeItem",
    "packageWidthCm",
    "packageHeightCm",
    "packageLengthCm",
    "parcelType",
    "codAmount",
    "deliveryFee",
] as const;
const UPDATE_PARCEL_FORM_FIELDS = [
    "parcelId",
    "merchantId",
    "riderId",
    "pickupLocationId",
    "pickupLocationLabel",
    "pickupTownshipId",
    "pickupAddress",
    "selectedMerchantContactId",
    "contactLabel",
    "saveRecipientContact",
    "recipientName",
    "recipientPhone",
    "recipientTownshipId",
    "recipientAddress",
    "parcelDescription",
    "packageCount",
    "specialHandlingNote",
    "estimatedWeightKg",
    "isLargeItem",
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
    "pickupLocationId",
    "pickupLocationLabel",
    "pickupTownshipId",
    "pickupAddress",
    "selectedMerchantContactId",
    "contactLabel",
    "saveRecipientContact",
    "recipientName",
    "recipientPhone",
    "recipientTownshipId",
    "recipientAddress",
    "parcelDescription",
    "packageCount",
    "specialHandlingNote",
    "estimatedWeightKg",
    "isLargeItem",
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
const STANDARD_PARCEL_DIMENSION_CM = 1;

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

const positiveMoneyField = z.preprocess((value) => {
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
}, z.number().finite().gt(0).max(999999999));

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

const positiveDecimalField = z.preprocess((value) => {
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
}, z.number().finite().gt(0).max(999999999));

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

const booleanField = z.preprocess((value) => {
    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value !== "string") {
        return value;
    }

    const normalized = value.trim().toLowerCase();

    if (normalized === "true") {
        return true;
    }

    if (normalized === "false") {
        return false;
    }

    return value;
}, z.boolean());

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

const createParcelBaseSchema = z.object({
    merchantId: z.string().trim().uuid(),
    riderId: optionalNullableUuid(),
    recipientName: z.string().trim().min(2).max(120),
    recipientPhone: z.string().trim().min(6).max(30),
    recipientTownshipId: z.string().trim().uuid(),
    recipientAddress: z.string().trim().min(3).max(255),
    parcelDescription: z.string().trim().min(1).max(2000),
    packageCount: positiveIntegerField,
    specialHandlingNote: optionalNullableTrimmedString(1000),
    estimatedWeightKg: positiveDecimalField,
    isLargeItem: booleanField,
    packageWidthCm: optionalDecimalField,
    packageHeightCm: optionalDecimalField,
    packageLengthCm: optionalDecimalField,
    parcelType: z.enum(PARCEL_TYPES),
    codAmount: moneyField,
    deliveryFee: positiveMoneyField,
    deliveryFeePayer: z.enum(DELIVERY_FEE_PAYERS),
    deliveryFeePaymentPlan: z.enum(DELIVERY_FEE_PAYMENT_PLANS),
    paymentNote: optionalNullableTrimmedString(1000),
});

function refineParcelDetailFields(
    value: Pick<
        z.infer<typeof createParcelBaseSchema>,
        | "parcelType"
        | "codAmount"
        | "isLargeItem"
        | "packageWidthCm"
        | "packageHeightCm"
        | "packageLengthCm"
    >,
    context: z.RefinementCtx,
) {
    if (value.parcelType === "cod" && value.codAmount <= 0) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["codAmount"],
            message: "COD amount must be greater than zero for COD parcels.",
        });
    }

    if (!value.isLargeItem) {
        return;
    }

    const dimensions = [
        ["packageLengthCm", value.packageLengthCm, "Length is required for large items."],
        ["packageWidthCm", value.packageWidthCm, "Width is required for large items."],
        ["packageHeightCm", value.packageHeightCm, "Height is required for large items."],
    ] as const;

    for (const [fieldName, dimension, message] of dimensions) {
        if (dimension === null || dimension <= 0) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: [fieldName],
                message,
            });
        }
    }
}

export const createParcelSchema = createParcelBaseSchema.superRefine(refineParcelDetailFields);

export const createParcelSharedSchema = createParcelBaseSchema
    .pick({
        merchantId: true,
        riderId: true,
        recipientName: true,
        recipientPhone: true,
        recipientTownshipId: true,
        recipientAddress: true,
        deliveryFeePayer: true,
        deliveryFeePaymentPlan: true,
        paymentNote: true,
    })
    .merge(merchantContactReferenceSchema)
    .merge(pickupLocationReferenceSchema);

export const createParcelRowSchema = createParcelBaseSchema
    .pick({
        parcelDescription: true,
        packageCount: true,
        specialHandlingNote: true,
        estimatedWeightKg: true,
        isLargeItem: true,
        packageWidthCm: true,
        packageHeightCm: true,
        packageLengthCm: true,
        parcelType: true,
        codAmount: true,
        deliveryFee: true,
    })
    .superRefine(refineParcelDetailFields);

export const createParcelBatchSchema = createParcelSharedSchema
    .extend({
        parcelRows: z
            .array(createParcelRowSchema)
            .min(1, "Add at least one parcel row.")
            .max(
                CREATE_PARCEL_MAX_ROWS,
                `You can create up to ${CREATE_PARCEL_MAX_ROWS} parcels at once.`,
            ),
    })
    .superRefine((value, context) => {
        const totalRequestedParcels = value.parcelRows.reduce(
            (total, row) => total + row.packageCount,
            0,
        );

        if (
            value.parcelRows.length <= CREATE_PARCEL_MAX_ROWS &&
            totalRequestedParcels > CREATE_PARCEL_MAX_ROWS
        ) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["parcelRows"],
                message: `You can create up to ${CREATE_PARCEL_MAX_ROWS} parcels at once. Reduce the package counts.`,
            });
        }

        if (value.deliveryFeePaymentPlan !== "merchant_deduct_from_cod_settlement") {
            return;
        }

        value.parcelRows.forEach((row, index) => {
            if (row.parcelType !== "cod") {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["parcelRows", index, "parcelType"],
                    message: "Deduct from COD settlement requires a COD parcel.",
                });
            }
        });
    });

export const updateParcelSchema = createParcelBaseSchema
    .extend({
        pickupLocationId: z.string().trim().uuid(),
        deliveryFeePaymentPlan: optionalNullableDeliveryFeePaymentPlanField,
        parcelId: z.string().trim().uuid(),
        parcelStatus: z.enum(PARCEL_STATUSES),
        deliveryFeeStatus: z.enum(DELIVERY_FEE_STATUSES),
        codStatus: z.enum(COD_STATUSES),
        collectionStatus: z.enum(COLLECTION_STATUSES),
        collectedAmount: moneyField,
    })
    .superRefine(refineParcelDetailFields);

export const updateParcelDetailSchema = createParcelBaseSchema
    .omit({ paymentNote: true })
    .extend({
        pickupLocationId: z.string().trim().uuid(),
        deliveryFeePaymentPlan: optionalNullableDeliveryFeePaymentPlanField,
        parcelId: z.string().trim().uuid(),
    })
    .merge(merchantContactReferenceSchema)
    .superRefine(refineParcelDetailFields);

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
export type ParcelCreateBatchInput = z.infer<typeof createParcelBatchSchema>;
export type ParcelCreateRowInput = z.infer<typeof createParcelRowSchema>;
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
    pickupLocationId: string | null;
    pickupTownshipId: string | null;
    pickupLocationLabel: string | null;
    pickupAddress: string | null;
    recipientName: string;
    recipientPhone: string;
    recipientTownshipId: string;
    recipientAddress: string;
    parcelDescription: string;
    packageCount: number;
    specialHandlingNote: string | null;
    estimatedWeightKg: string | null;
    isLargeItem: boolean;
    packageWidthCm: string;
    packageHeightCm: string;
    packageLengthCm: string;
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
    deliveryFeePaymentPlan: (typeof DELIVERY_FEE_PAYMENT_PLANS)[number] | null;
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

    const candidateStatuses = getAllowedDeliveryFeeStatusesForParcel(parcel).filter(
        (status) => status !== "unpaid",
    );

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

function getNonCodSettlementBlockedReasons(
    parcel: ParcelOperationInput,
): ParcelOperationSummary["settlement"]["blockedReasons"] {
    if (parcel.deliveryFeeStatus === "bill_merchant") {
        return parcel.parcelStatus === "delivered" ||
            parcel.parcelStatus === "returned" ||
            parcel.parcelStatus === "cancelled"
            ? []
            : ["Parcel is not in a fee-charge settlement state."];
    }

    const deliveryFeePlan = parcel.deliveryFeePaymentPlan;
    const isRefundableSettlementPlan =
        deliveryFeePlan === "merchant_prepaid_bank_transfer" ||
        deliveryFeePlan === "merchant_cash_on_pickup";
    const supportsRefundSettlement =
        parcel.deliveryFeePayer === "merchant" &&
        Number(parcel.deliveryFee) > 0 &&
        isRefundableSettlementPlan;

    if (!supportsRefundSettlement) {
        return [];
    }

    const blockedReasons: string[] = [];

    if (parcel.parcelStatus !== "cancelled") {
        blockedReasons.push("Parcel is not cancelled.");
    }

    if (parcel.deliveryFeeStatus !== "paid_by_merchant") {
        blockedReasons.push("Refund requires verified merchant payment.");
    }

    return blockedReasons;
}

function hasNonCodSettlementFlow(parcel: ParcelOperationInput) {
    if (parcel.deliveryFeeStatus === "bill_merchant") {
        return true;
    }

    const deliveryFeePlan = parcel.deliveryFeePaymentPlan;
    const isRefundableSettlementPlan =
        deliveryFeePlan === "merchant_prepaid_bank_transfer" ||
        deliveryFeePlan === "merchant_cash_on_pickup";

    return (
        parcel.deliveryFeePayer === "merchant" &&
        Number(parcel.deliveryFee) > 0 &&
        isRefundableSettlementPlan &&
        (parcel.deliveryFeeStatus === "paid_by_merchant" || parcel.parcelStatus === "cancelled")
    );
}

function getCashOperationState(parcel: ParcelOperationInput): ParcelOperationSummary["cash"] {
    if (parcel.parcelType !== "cod") {
        return { label: "Not applicable", tone: "muted", canReceiveAtOffice: false };
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
    if (parcel.merchantSettlementStatus === "settled") {
        return { label: "Settled", tone: "success", blockedReasons };
    }

    if (isParcelSettlementLocked(parcel)) {
        return { label: "Locked by settlement", tone: "info", blockedReasons };
    }

    if (parcel.parcelType !== "cod") {
        if (!hasNonCodSettlementFlow(parcel)) {
            return { label: "No active settlement", tone: "muted", blockedReasons: [] };
        }

        const nonCodBlockedReasons = getNonCodSettlementBlockedReasons(parcel);

        if (nonCodBlockedReasons.length === 0) {
            return { label: "Settlement ready", tone: "success", blockedReasons: [] };
        }

        return {
            label: "Settlement blocked",
            tone: "warning",
            blockedReasons: nonCodBlockedReasons,
        };
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

function toFieldPath(path: (string | number)[]) {
    return path.reduce((result, segment) => {
        if (typeof segment === "number") {
            return `${result}[${segment}]`;
        }

        return result ? `${result}.${segment}` : segment;
    }, "");
}

function toIssueFieldErrors(issues: z.ZodIssue[]) {
    const fieldErrors: ParcelFieldErrors = {};

    for (const issue of issues) {
        const fieldPath = toFieldPath(issue.path);

        if (!fieldPath) {
            continue;
        }

        const messages = fieldErrors[fieldPath] ?? [];
        messages.push(issue.message);
        fieldErrors[fieldPath] = messages;
    }

    return fieldErrors;
}

function createFieldErrors(fieldName: string, message: string): ParcelFieldErrors {
    return {
        [fieldName]: [message],
    };
}

export function validateParcelStatusProofImages(input: {
    nextStatus: (typeof PARCEL_STATUSES)[number];
    pickupImageKeys: string[];
    proofOfDeliveryImageKeys: string[];
}) {
    if (input.nextStatus === "at_office" && input.pickupImageKeys.length === 0) {
        return {
            ok: false as const,
            message: "Upload at least one pickup image before marking parcel at office.",
            fieldErrors: createFieldErrors(
                "pickupImages",
                "Upload at least one pickup image before marking parcel at office.",
            ),
        };
    }

    if (input.nextStatus === "delivered" && input.proofOfDeliveryImageKeys.length === 0) {
        return {
            ok: false as const,
            message: "Upload at least one proof of delivery image before marking parcel delivered.",
            fieldErrors: createFieldErrors(
                "proofOfDeliveryImages",
                "Upload at least one proof of delivery image before marking parcel delivered.",
            ),
        };
    }

    return { ok: true as const };
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
        existingPaymentSlipImageCount: 0,
    });
}

export function validatePaymentSlipImagesForPlan(input: {
    deliveryFeePaymentPlan: (typeof DELIVERY_FEE_PAYMENT_PLANS)[number] | null;
    paymentSlipImages: File[];
    existingPaymentSlipImageCount?: number;
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

    const totalPaymentSlipImageCount =
        (input.existingPaymentSlipImageCount ?? 0) + input.paymentSlipImages.length;

    if (
        input.deliveryFeePaymentPlan === "merchant_prepaid_bank_transfer" &&
        totalPaymentSlipImageCount === 0
    ) {
        return {
            ok: false as const,
            message: "Upload at least one payment slip for prepaid bank transfer.",
            fieldErrors: createFieldErrors(
                "paymentSlipImages",
                "Upload at least one payment slip for prepaid bank transfer.",
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

function getCreateParcelRowIndexes(formData: FormData) {
    const rowIndexes = new Set<number>();

    for (const [key] of formData.entries()) {
        const match = /^parcelRows\[(\d+)\]\./.exec(key);

        if (match) {
            rowIndexes.add(Number(match[1]));
        }
    }

    return [...rowIndexes].sort((left, right) => left - right);
}

function getCreateParcelBatchFields(
    formData: FormData,
    rowIndexes: number[],
): Record<string, string> {
    const sharedFields = getScalarFields(formData, CREATE_PARCEL_SHARED_FORM_FIELDS);
    const rowFields = Object.fromEntries(
        rowIndexes.flatMap((rowIndex) =>
            CREATE_PARCEL_ROW_FIELDS.map((fieldName) => [
                `parcelRows[${rowIndex}].${fieldName}`,
                getStringFieldValue(formData, `parcelRows[${rowIndex}].${fieldName}`),
            ]),
        ),
    );

    return {
        ...sharedFields,
        ...rowFields,
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
    const rowIndexes = getCreateParcelRowIndexes(formData);
    const fields = getCreateParcelBatchFields(formData, rowIndexes);
    const files = getParcelMediaFiles(formData);
    const mediaValidation = validateParcelMediaFiles(files);

    if (!mediaValidation.ok) {
        return {
            ok: false as const,
            message: mediaValidation.message,
            fields,
            fieldErrors: mediaValidation.fieldErrors,
        };
    }

    const parsed = createParcelBatchSchema.safeParse({
        merchantId: fields.merchantId,
        riderId: fields.riderId,
        pickupLocationId: fields.pickupLocationId,
        pickupLocationLabel: fields.pickupLocationLabel,
        pickupTownshipId: fields.pickupTownshipId,
        pickupAddress: fields.pickupAddress,
        savePickupLocation: fields.savePickupLocation,
        selectedMerchantContactId: fields.selectedMerchantContactId,
        contactLabel: fields.contactLabel,
        saveRecipientContact: fields.saveRecipientContact,
        recipientName: fields.recipientName,
        recipientPhone: fields.recipientPhone,
        recipientTownshipId: fields.recipientTownshipId,
        recipientAddress: fields.recipientAddress,
        deliveryFeePayer: fields.deliveryFeePayer,
        deliveryFeePaymentPlan: fields.deliveryFeePaymentPlan,
        paymentNote: fields.paymentNote,
        parcelRows: rowIndexes.map((rowIndex) => ({
            parcelDescription: fields[`parcelRows[${rowIndex}].parcelDescription`],
            packageCount: fields[`parcelRows[${rowIndex}].packageCount`],
            specialHandlingNote: fields[`parcelRows[${rowIndex}].specialHandlingNote`],
            estimatedWeightKg: fields[`parcelRows[${rowIndex}].estimatedWeightKg`],
            isLargeItem: fields[`parcelRows[${rowIndex}].isLargeItem`],
            packageWidthCm: fields[`parcelRows[${rowIndex}].packageWidthCm`],
            packageHeightCm: fields[`parcelRows[${rowIndex}].packageHeightCm`],
            packageLengthCm: fields[`parcelRows[${rowIndex}].packageLengthCm`],
            parcelType: fields[`parcelRows[${rowIndex}].parcelType`],
            codAmount: fields[`parcelRows[${rowIndex}].codAmount`],
            deliveryFee: fields[`parcelRows[${rowIndex}].deliveryFee`],
        })),
    });

    if (!parsed.success) {
        return {
            ok: false as const,
            message: "Please correct the highlighted fields.",
            fields,
            fieldErrors: toIssueFieldErrors(parsed.error.issues),
        };
    }

    return {
        ok: true as const,
        data: parsed.data,
        fields,
        files,
    };
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

function getStoredParcelDimensions(input: {
    isLargeItem: boolean;
    packageWidthCm: number | null;
    packageHeightCm: number | null;
    packageLengthCm: number | null;
}) {
    if (!input.isLargeItem) {
        const standardDimension = toMoneyString(STANDARD_PARCEL_DIMENSION_CM);

        return {
            packageWidthCm: standardDimension,
            packageHeightCm: standardDimension,
            packageLengthCm: standardDimension,
        };
    }

    return {
        packageWidthCm: toMoneyString(input.packageWidthCm ?? STANDARD_PARCEL_DIMENSION_CM),
        packageHeightCm: toMoneyString(input.packageHeightCm ?? STANDARD_PARCEL_DIMENSION_CM),
        packageLengthCm: toMoneyString(input.packageLengthCm ?? STANDARD_PARCEL_DIMENSION_CM),
    };
}

export function buildParcelWriteValues(input: {
    data: ParcelCreateInput | ParcelUpdateInput | ParcelDetailUpdateInput;
    merchantId: string;
    riderId: string | null;
    pickupDetails: {
        id: string | null;
        label: string;
        townshipId: string;
        pickupAddress: string;
    };
    totalAmountToCollect: number;
    deliveryFeePaymentPlan: (typeof DELIVERY_FEE_PAYMENT_PLANS)[number] | null;
    parcelStatus: (typeof PARCEL_STATUSES)[number];
    pickupImageKeys: string[];
    proofOfDeliveryImageKeys: string[];
}) {
    const storedDimensions = getStoredParcelDimensions({
        isLargeItem: input.data.isLargeItem,
        packageWidthCm: input.data.packageWidthCm,
        packageHeightCm: input.data.packageHeightCm,
        packageLengthCm: input.data.packageLengthCm,
    });

    return {
        merchantId: input.merchantId,
        riderId: input.riderId,
        pickupLocationId: input.pickupDetails.id,
        pickupTownshipId: input.pickupDetails.townshipId,
        pickupLocationLabel: input.pickupDetails.label,
        pickupAddress: input.pickupDetails.pickupAddress,
        recipientName: input.data.recipientName,
        recipientPhone: input.data.recipientPhone,
        recipientTownshipId: input.data.recipientTownshipId,
        recipientAddress: input.data.recipientAddress,
        parcelDescription: input.data.parcelDescription,
        packageCount: input.data.packageCount,
        specialHandlingNote: input.data.specialHandlingNote,
        estimatedWeightKg: toMoneyString(input.data.estimatedWeightKg),
        isLargeItem: input.data.isLargeItem,
        packageWidthCm: storedDimensions.packageWidthCm,
        packageHeightCm: storedDimensions.packageHeightCm,
        packageLengthCm: storedDimensions.packageLengthCm,
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

export async function uploadParcelMediaFiles(input: { scope: string; files: ParcelMediaFiles }) {
    const uploadGroup = async (category: string, files: File[]) => {
        return Promise.all(
            files.map(async (file) => {
                const key = buildR2ObjectKey({
                    scope: input.scope,
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

export function getDefaultCreateCollectionStatus(parcelType: (typeof PARCEL_TYPES)[number]) {
    return parcelType === "non_cod" ? "void" : "pending";
}

export async function validateParcelSubmission(input: {
    merchantId: string;
    riderId: string | null;
    pickupLocationId: string;
    recipientTownshipId: string;
    parcelType: (typeof PARCEL_TYPES)[number];
    codAmount: number;
    deliveryFee: number;
    deliveryFeePayer: (typeof DELIVERY_FEE_PAYERS)[number];
    deliveryFeeStatus?: (typeof DELIVERY_FEE_STATUSES)[number];
    deliveryFeePaymentPlan?: (typeof DELIVERY_FEE_PAYMENT_PLANS)[number] | null;
    requireRecordedDeliveryFeePaymentPlan?: boolean;
    parcelStatus?: (typeof PARCEL_STATUSES)[number];
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

    const pickupLocation = await findMerchantPickupLocationById({
        merchantId: input.merchantId,
        pickupLocationId: input.pickupLocationId,
    });

    if (!pickupLocation) {
        return { ok: false as const, message: "Selected pickup location was not found." };
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

    if (input.deliveryFeeStatus && input.parcelStatus) {
        const deliveryFeeStatusGuard = validateDeliveryFeeStatusForParcel({
            deliveryFeePayer: input.deliveryFeePayer,
            deliveryFeePaymentPlan: input.deliveryFeePaymentPlan ?? null,
            parcelStatus: input.parcelStatus,
            deliveryFeeStatus: input.deliveryFeeStatus,
            fieldName: "deliveryFeePaymentPlan",
        });

        if (!deliveryFeeStatusGuard.ok) {
            return deliveryFeeStatusGuard;
        }
    }

    return validateUpdateCodState({
        parcelType: input.parcelType,
        codStatus: input.codStatus,
    });
}

export async function validateCreateParcelBatchSubmission(input: {
    merchantId: string;
    riderId: string | null;
    pickupTownshipId: string;
    recipientTownshipId: string;
    deliveryFeePayer: (typeof DELIVERY_FEE_PAYERS)[number];
    deliveryFeePaymentPlan: (typeof DELIVERY_FEE_PAYMENT_PLANS)[number];
    parcelRows: ParcelCreateRowInput[];
}) {
    const merchant = await findMerchantProfileLinkByAppUserId(input.merchantId);

    if (!merchant) {
        return {
            ok: false as const,
            message: "Selected merchant was not found.",
            fieldErrors: createFieldErrors("merchantId", "Selected merchant was not found."),
        };
    }

    if (input.riderId) {
        const rider = await getRiderById(input.riderId);

        if (!rider?.isActive) {
            return {
                ok: false as const,
                message: "Selected rider was not found.",
                fieldErrors: createFieldErrors("riderId", "Selected rider was not found."),
            };
        }
    }

    const township = await findTownshipById(input.recipientTownshipId);

    if (!township?.isActive) {
        return {
            ok: false as const,
            message: "Selected recipient township was not found.",
            fieldErrors: createFieldErrors(
                "recipientTownshipId",
                "Selected recipient township was not found.",
            ),
        };
    }

    const pickupTownship = await findTownshipById(input.pickupTownshipId);

    if (!pickupTownship?.isActive) {
        return {
            ok: false as const,
            message: "Selected pickup township was not found.",
            fieldErrors: createFieldErrors(
                "pickupTownshipId",
                "Selected pickup township was not found.",
            ),
        };
    }

    for (const [rowIndex, row] of input.parcelRows.entries()) {
        const paymentPlanGuard = validateDeliveryFeePaymentPlan({
            parcelType: row.parcelType,
            deliveryFeePayer: input.deliveryFeePayer,
            deliveryFeePaymentPlan: input.deliveryFeePaymentPlan,
            requireRecordedPlan: true,
        });

        if (!paymentPlanGuard.ok) {
            return {
                ok: false as const,
                message: paymentPlanGuard.message,
                fieldErrors:
                    input.deliveryFeePaymentPlan === "merchant_deduct_from_cod_settlement"
                        ? createFieldErrors(
                              `parcelRows[${rowIndex}].parcelType`,
                              "Deduct from COD settlement requires a COD parcel.",
                          )
                        : paymentPlanGuard.fieldErrors,
            };
        }
    }

    return { ok: true as const };
}

export function validateImmutablePackageCount(input: {
    currentPackageCount: number;
    submittedPackageCount: number;
}) {
    if (input.submittedPackageCount === input.currentPackageCount) {
        return { ok: true as const };
    }

    return {
        ok: false as const,
        message: "Package count cannot be changed after parcel creation.",
        fieldErrors: createFieldErrors(
            "packageCount",
            "Package count cannot be changed after parcel creation.",
        ),
    };
}
