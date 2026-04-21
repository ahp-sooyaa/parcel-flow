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
import { buildR2ObjectKey, getSignedR2ObjectUrl, uploadR2Object } from "@/lib/r2";
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
    "paymentNote",
] as const;
const UPDATE_PARCEL_FORM_FIELDS = [
    "parcelId",
    ...CREATE_PARCEL_FORM_FIELDS,
    "parcelStatus",
    "deliveryFeeStatus",
    "codStatus",
    "collectionStatus",
    "merchantSettlementStatus",
    "riderPayoutStatus",
    "collectedAmount",
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
export const riderParcelImageUploadSchema = z.object({
    parcelId: z.string().trim().uuid(),
});

export type ParcelCreateInput = z.infer<typeof createParcelSchema>;
export type ParcelUpdateInput = z.infer<typeof updateParcelSchema>;
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
    data: ParcelCreateInput | ParcelUpdateInput;
    merchantId: string;
    riderId: string | null;
    totalAmountToCollect: number;
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
