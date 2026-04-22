import "server-only";
import { z } from "zod";
import {
    MERCHANT_SETTLEMENT_SLIP_ALLOWED_TYPES,
    MERCHANT_SETTLEMENT_SLIP_MAX_SIZE_BYTES,
} from "@/features/merchant-settlements/constants";
import { buildR2ObjectKey, getSignedR2ObjectUrl, uploadR2Object } from "@/lib/r2";

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

export function toSettlementMoneyString(value: number) {
    return value.toFixed(2);
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
