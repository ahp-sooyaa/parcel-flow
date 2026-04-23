import "server-only";
import { z } from "zod";
import {
    MERCHANT_SETTLEMENT_RECORD_STATUSES,
    MERCHANT_SETTLEMENT_SLIP_ALLOWED_TYPES,
    MERCHANT_SETTLEMENT_SLIP_MAX_SIZE_BYTES,
} from "@/features/merchant-settlements/constants";
import { buildR2ObjectKey, getSignedR2ObjectUrl, uploadR2Object } from "@/lib/r2";

import type {
    MerchantSettlementItemDto,
    MerchantSettlementListQuery,
    MerchantSettlementStatus,
    MerchantSettlementTotalsDto,
} from "@/features/merchant-settlements/server/dto";
import type { DELIVERY_FEE_STATUSES } from "@/features/parcels/constants";
import type { ParcelImageAsset } from "@/features/parcels/server/utils";

const generateSettlementSchema = z.object({
    merchantId: z.string().trim().uuid(),
    bankAccountId: z.string().trim().uuid(),
    paymentRecordIds: z.array(z.string().trim().uuid()).min(1),
});

const settlementIdSchema = z.object({
    settlementId: z.string().trim().uuid(),
});

const confirmSettlementSchema = settlementIdSchema.extend({
    referenceNo: z.string().trim().min(1).max(120),
});
const allowedSlipTypes = new Set<string>(MERCHANT_SETTLEMENT_SLIP_ALLOWED_TYPES);
const settlementStatusValues = new Set<string>(MERCHANT_SETTLEMENT_RECORD_STATUSES);
export const MERCHANT_SETTLEMENT_LIST_PAGE_SIZE = 20;

export function toSettlementMoneyString(value: number) {
    return value.toFixed(2);
}

export function formatMerchantSettlementLabel(value: string) {
    return value
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function getSearchParamValue(
    searchParams: Record<string, string | string[] | undefined>,
    key: string,
) {
    const value = searchParams[key];

    if (Array.isArray(value)) {
        return value[0] ?? "";
    }

    return value ?? "";
}

function normalizePositiveInteger(value: string, fallback: number) {
    const parsed = Number.parseInt(value, 10);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function normalizeMerchantSettlementListQueryParams(
    searchParams: Record<string, string | string[] | undefined>,
): MerchantSettlementListQuery {
    const status = getSearchParamValue(searchParams, "status");

    return {
        query: getSearchParamValue(searchParams, "q").trim().slice(0, 120),
        status: settlementStatusValues.has(status) ? (status as MerchantSettlementStatus) : null,
        page: normalizePositiveInteger(getSearchParamValue(searchParams, "page"), 1),
        pageSize: MERCHANT_SETTLEMENT_LIST_PAGE_SIZE,
    };
}

export function buildMerchantSettlementListHref(query: MerchantSettlementListQuery) {
    const params = new URLSearchParams();

    if (query.query) {
        params.set("q", query.query);
    }

    if (query.status) {
        params.set("status", query.status);
    }

    if (query.page > 1) {
        params.set("page", String(query.page));
    }

    const queryString = params.toString();

    return queryString ? `/dashboard/settlements?${queryString}` : "/dashboard/settlements";
}

export function isMerchantSettlementId(value: string) {
    return settlementIdSchema.safeParse({ settlementId: value }).success;
}

export function getSafeSettlementReturnHref(value: string | null | undefined) {
    const fallback = "/dashboard/settlements";

    if (!value || value.startsWith("//") || !value.startsWith("/")) {
        return fallback;
    }

    try {
        const url = new URL(value, "https://parcel-flow.local");

        if (url.pathname === "/dashboard/settlements") {
            const query = normalizeMerchantSettlementListQueryParams({
                q: url.searchParams.get("q") ?? undefined,
                status: url.searchParams.get("status") ?? undefined,
                page: url.searchParams.get("page") ?? undefined,
            });

            return buildMerchantSettlementListHref(query);
        }

        if (/^\/dashboard\/merchants\/[0-9a-f-]{36}$/i.test(url.pathname)) {
            return url.searchParams.get("tab") === "settlements"
                ? `${url.pathname}?tab=settlements`
                : fallback;
        }
    } catch {
        return fallback;
    }

    return fallback;
}

export function buildSettlementInvoiceFileName(input: {
    settlementId: string;
    referenceNo: string | null;
}) {
    const rawIdentifier = input.referenceNo || input.settlementId.slice(0, 8);
    const identifier =
        rawIdentifier
            .trim()
            .toLowerCase()
            .replaceAll(/[^a-z0-9.-]+/g, "-")
            .replaceAll(/^-+|-+$/g, "")
            .slice(0, 80) || input.settlementId.slice(0, 8);

    return `settlement-${identifier}.pdf`;
}

export function calculateSettlementItemAmounts(input: {
    codAmount: string;
    deliveryFee: string;
    deliveryFeeStatus: (typeof DELIVERY_FEE_STATUSES)[number];
}) {
    const codAmount = Number(input.codAmount);
    const deliveryFee = Number(input.deliveryFee);
    const isDeliveryFeeDeducted = input.deliveryFeeStatus === "deduct_from_settlement";
    const netPayableAmount = isDeliveryFeeDeducted ? codAmount - deliveryFee : codAmount;

    return {
        snapshotCodAmount: toSettlementMoneyString(codAmount),
        snapshotDeliveryFee: toSettlementMoneyString(deliveryFee),
        isDeliveryFeeDeducted,
        netPayableAmount: toSettlementMoneyString(netPayableAmount),
    };
}

export function calculateSettlementTotals(
    items: readonly Pick<
        MerchantSettlementItemDto,
        "snapshotCodAmount" | "snapshotDeliveryFee" | "isDeliveryFeeDeducted" | "netPayableAmount"
    >[],
): MerchantSettlementTotalsDto {
    return {
        codSubtotal: toSettlementMoneyString(
            items.reduce((sum, item) => sum + Number(item.snapshotCodAmount), 0),
        ),
        deliveryFeeDeductedTotal: toSettlementMoneyString(
            items.reduce(
                (sum, item) =>
                    sum + (item.isDeliveryFeeDeducted ? Number(item.snapshotDeliveryFee) : 0),
                0,
            ),
        ),
        netPayableTotal: toSettlementMoneyString(
            items.reduce((sum, item) => sum + Number(item.netPayableAmount), 0),
        ),
    };
}

export function parseGenerateSettlementFormData(formData: FormData) {
    const parsed = generateSettlementSchema.safeParse({
        merchantId: formData.get("merchantId"),
        bankAccountId: formData.get("bankAccountId"),
        paymentRecordIds: Array.from(
            new Set(
                formData
                    .getAll("paymentRecordIds")
                    .filter((value): value is string => typeof value === "string"),
            ),
        ),
    });

    if (!parsed.success) {
        return {
            ok: false as const,
            message: "Select at least one parcel and a valid merchant bank account.",
            fieldErrors: parsed.error.flatten().fieldErrors,
        };
    }

    return { ok: true as const, data: parsed.data };
}

export function parseSettlementIdFormData(formData: FormData) {
    const parsed = settlementIdSchema.safeParse({
        settlementId: formData.get("settlementId"),
    });

    if (!parsed.success) {
        return { ok: false as const, message: "Settlement id is required." };
    }

    return { ok: true as const, data: parsed.data };
}

export function parseConfirmSettlementFormData(formData: FormData) {
    const parsed = confirmSettlementSchema.safeParse({
        settlementId: formData.get("settlementId"),
        referenceNo: formData.get("referenceNo"),
    });

    if (!parsed.success) {
        return {
            ok: false as const,
            message: "Reference number and settlement id are required.",
            fieldErrors: parsed.error.flatten().fieldErrors,
        };
    }

    const file = formData.get("paymentSlipImage");

    if (!(file instanceof File) || file.size === 0 || file.name === "") {
        return {
            ok: false as const,
            message: "Payment slip image is required.",
            fieldErrors: { paymentSlipImage: ["Upload a payment slip image."] },
        };
    }

    if (!allowedSlipTypes.has(file.type)) {
        return {
            ok: false as const,
            message: "Payment slip must be JPG, PNG, or WebP.",
            fieldErrors: { paymentSlipImage: ["Only JPG, PNG, or WebP files are allowed."] },
        };
    }

    if (file.size > MERCHANT_SETTLEMENT_SLIP_MAX_SIZE_BYTES) {
        return {
            ok: false as const,
            message: "Payment slip must be 1 MB or smaller.",
            fieldErrors: { paymentSlipImage: ["Payment slip must be 1 MB or smaller."] },
        };
    }

    return { ok: true as const, data: parsed.data, file };
}

export async function uploadSettlementPaymentSlip(input: { settlementId: string; file: File }) {
    const key = buildR2ObjectKey({
        scope: `merchant-settlement-${input.settlementId}`,
        category: "payment-slip",
        originalFileName: input.file.name,
    });

    return uploadR2Object({ key, file: input.file });
}

export async function signSettlementPaymentSlipKeys(keys: string[]): Promise<ParcelImageAsset[]> {
    return Promise.all(
        keys.map(async (key) => ({
            key,
            url: await getSignedR2ObjectUrl(key),
        })),
    );
}
