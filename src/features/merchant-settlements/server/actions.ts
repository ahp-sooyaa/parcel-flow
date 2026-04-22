"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import {
    cancelOrRejectMerchantSettlement,
    confirmMerchantSettlementPayment,
    findConfirmableMerchantSettlement,
    generateMerchantSettlement,
} from "./dal";
import {
    parseConfirmSettlementFormData,
    parseGenerateSettlementFormData,
    parseSettlementIdFormData,
    uploadSettlementPaymentSlip,
} from "./utils";
import { requirePermission } from "@/features/auth/server/utils";

import type { MerchantSettlementActionResult } from "./dto";

const initialError = {
    ok: false,
    message: "Unable to process settlement.",
} satisfies MerchantSettlementActionResult;

function revalidateMerchantSettlementPaths(merchantId: string) {
    revalidatePath(`/dashboard/merchants/${merchantId}`);
    revalidatePath("/dashboard/parcels");
}

export async function generateMerchantSettlementAction(
    _prevState: MerchantSettlementActionResult,
    formData: FormData,
): Promise<MerchantSettlementActionResult> {
    try {
        const currentUser = await requirePermission("merchant-settlement.create");
        const parsed = parseGenerateSettlementFormData(formData);

        if (!parsed.ok) {
            return {
                ok: false,
                message: parsed.message,
                fieldErrors: parsed.fieldErrors,
            };
        }

        const generated = await generateMerchantSettlement({
            ...parsed.data,
            actorAppUserId: currentUser.appUserId,
        });

        revalidateMerchantSettlementPaths(generated.merchantId);

        return {
            ok: true,
            message: "Settlement generated.",
            settlementId: generated.settlementId,
        };
    } catch (error) {
        return {
            ...initialError,
            message: error instanceof Error ? error.message : initialError.message,
        };
    }
}

export async function confirmMerchantSettlementPaymentAction(
    _prevState: MerchantSettlementActionResult,
    formData: FormData,
): Promise<MerchantSettlementActionResult> {
    try {
        const currentUser = await requirePermission("merchant-settlement.confirm");
        const parsed = parseConfirmSettlementFormData(formData);

        if (!parsed.ok) {
            return {
                ok: false,
                message: parsed.message,
                fieldErrors: parsed.fieldErrors,
            };
        }

        const settlement = await findConfirmableMerchantSettlement(parsed.data.settlementId);

        if (!settlement) {
            return { ok: false, message: "Settlement cannot be confirmed." };
        }

        const paymentSlipImageKey = await uploadSettlementPaymentSlip({
            settlementId: parsed.data.settlementId,
            file: parsed.file,
        });
        const confirmed = await confirmMerchantSettlementPayment({
            settlementId: parsed.data.settlementId,
            actorAppUserId: currentUser.appUserId,
            referenceNo: parsed.data.referenceNo,
            paymentSlipImageKey,
        });

        revalidateMerchantSettlementPaths(confirmed.merchantId);

        return {
            ok: true,
            message: "Settlement marked paid.",
            settlementId: confirmed.settlementId,
        };
    } catch (error) {
        return {
            ...initialError,
            message: error instanceof Error ? error.message : initialError.message,
        };
    }
}

async function cancelOrRejectSettlementAction(
    formData: FormData,
    status: "cancelled" | "rejected",
): Promise<MerchantSettlementActionResult> {
    try {
        const currentUser = await requirePermission("merchant-settlement.cancel");
        const parsed = parseSettlementIdFormData(formData);

        if (!parsed.ok) {
            return { ok: false, message: parsed.message };
        }

        const updated = await cancelOrRejectMerchantSettlement({
            settlementId: parsed.data.settlementId,
            actorAppUserId: currentUser.appUserId,
            status,
        });

        revalidateMerchantSettlementPaths(updated.merchantId);

        return {
            ok: true,
            message: status === "cancelled" ? "Settlement cancelled." : "Settlement rejected.",
            settlementId: updated.settlementId,
        };
    } catch (error) {
        return {
            ...initialError,
            message: error instanceof Error ? error.message : initialError.message,
        };
    }
}

export async function cancelMerchantSettlementAction(
    _prevState: MerchantSettlementActionResult,
    formData: FormData,
): Promise<MerchantSettlementActionResult> {
    return cancelOrRejectSettlementAction(formData, "cancelled");
}

export async function rejectMerchantSettlementAction(
    _prevState: MerchantSettlementActionResult,
    formData: FormData,
): Promise<MerchantSettlementActionResult> {
    return cancelOrRejectSettlementAction(formData, "rejected");
}
