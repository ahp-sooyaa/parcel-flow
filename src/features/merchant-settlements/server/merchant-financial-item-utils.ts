import "server-only";
import {
    MERCHANT_SETTLEMENT_PRESETS,
    MERCHANT_SETTLEMENT_TYPES,
} from "@/features/merchant-settlements/constants";

import type {
    MerchantFinancialDirection,
    MerchantFinancialItemDerivationInput,
    MerchantFinancialItemDraft,
    MerchantFinancialItemKind,
    MerchantSettlementCandidateDto,
    MerchantSettlementDirection,
    MerchantSettlementPreset,
    MerchantSettlementSelectionSummaryDto,
} from "./merchant-financial-item-dto";

const refundableDeliveryFeePlans = new Set<string>([
    "merchant_prepaid_bank_transfer",
    "merchant_cash_on_pickup",
] as const);
const returnParcelStatuses = new Set<string>([
    "return_to_office",
    "return_to_merchant",
    "returned",
    "cancelled",
] as const);

export function toSettlementMoneyString(value: number) {
    return value.toFixed(2);
}

export function toSignedSettlementAmount(input: {
    amount: number | string;
    direction: MerchantFinancialDirection;
}) {
    const amount = typeof input.amount === "string" ? Number(input.amount) : input.amount;

    return input.direction === "company_owes_merchant" ? amount : amount * -1;
}

export function getSettlementDirectionForNetAmount(netAmount: number): MerchantSettlementDirection {
    if (netAmount > 0) {
        return "remit";
    }

    if (netAmount < 0) {
        return "invoice";
    }

    return "balanced";
}

export function calculateSettlementSelectionSummary(
    candidates: readonly Pick<MerchantSettlementCandidateDto, "direction" | "amount">[],
): MerchantSettlementSelectionSummaryDto {
    const totals = candidates.reduce(
        (summary, candidate) => {
            const amount = Number(candidate.amount);

            if (candidate.direction === "company_owes_merchant") {
                summary.creditsTotal += amount;
            } else {
                summary.debitsTotal += amount;
            }

            return summary;
        },
        {
            creditsTotal: 0,
            debitsTotal: 0,
        },
    );
    const netTotal = totals.creditsTotal - totals.debitsTotal;

    return {
        selectedCount: candidates.length,
        creditsTotal: toSettlementMoneyString(totals.creditsTotal),
        debitsTotal: toSettlementMoneyString(totals.debitsTotal),
        netTotal: toSettlementMoneyString(netTotal),
        direction: getSettlementDirectionForNetAmount(netTotal),
    };
}

export function formatMerchantFinancialItemKind(value: MerchantFinancialItemKind) {
    return value
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

export function formatMerchantFinancialDirection(value: MerchantFinancialDirection) {
    return value === "company_owes_merchant" ? "Company Owes Merchant" : "Merchant Owes Company";
}

export function requiresSettlementBankAccount(direction: MerchantSettlementDirection) {
    return direction !== "balanced";
}

export function getSettlementBankAccountLabel(direction: MerchantSettlementDirection) {
    if (direction === "invoice") {
        return "Company Bank Account";
    }

    if (direction === "balanced") {
        return "No Bank Account Needed";
    }

    return "Merchant Bank Account";
}

export function getDefaultSettlementPreset(
    value: string | null | undefined,
): MerchantSettlementPreset {
    return MERCHANT_SETTLEMENT_PRESETS.includes(value as MerchantSettlementPreset)
        ? (value as MerchantSettlementPreset)
        : "all";
}

export function matchesSettlementPreset(
    candidate: Pick<MerchantSettlementCandidateDto, "kind" | "parcelStatus">,
    preset: MerchantSettlementPreset,
) {
    if (preset === "all") {
        return true;
    }

    if (preset === "cod") {
        return candidate.kind === "cod_remit_credit";
    }

    if (preset === "fees") {
        return candidate.kind === "delivery_fee_charge";
    }

    return (
        candidate.kind === "refund_credit" ||
        returnParcelStatuses.has(candidate.parcelStatus ?? "cancelled")
    );
}

export function getLegacyParcelSettlementState(
    items: ReadonlyArray<{
        lifecycleState: "open" | "locked" | "closed" | "void";
        merchantSettlementId: string | null;
    }>,
) {
    const lockedItem = items.find(
        (item) => item.lifecycleState === "locked" && Boolean(item.merchantSettlementId),
    );

    if (lockedItem?.merchantSettlementId) {
        return {
            merchantSettlementStatus: "in_progress" as const,
            merchantSettlementId: lockedItem.merchantSettlementId,
        };
    }

    if (items.some((item) => item.lifecycleState === "open")) {
        return {
            merchantSettlementStatus: "pending" as const,
            merchantSettlementId: null,
        };
    }

    const closedItem = items.find(
        (item) => item.lifecycleState === "closed" && Boolean(item.merchantSettlementId),
    );

    if (closedItem?.merchantSettlementId) {
        return {
            merchantSettlementStatus: "settled" as const,
            merchantSettlementId: closedItem.merchantSettlementId,
        };
    }

    return {
        merchantSettlementStatus: "pending" as const,
        merchantSettlementId: null,
    };
}

function hasLegacySettlementLock(
    input: Pick<
        MerchantFinancialItemDerivationInput,
        "merchantSettlementStatus" | "merchantSettlementId"
    >,
) {
    return input.merchantSettlementStatus !== "pending" || Boolean(input.merchantSettlementId);
}

function buildCodRemitCredit(
    input: MerchantFinancialItemDerivationInput,
): MerchantFinancialItemDraft | null {
    if (input.parcelType !== "cod" || hasLegacySettlementLock(input)) {
        return null;
    }

    const blockedReasons: string[] = [];
    const codAmount = Number(input.codAmount);
    const deliveryFee = Number(input.deliveryFee);
    const isDeliveryFeeDeducted = input.deliveryFeeStatus === "deduct_from_settlement";

    if (input.parcelStatus !== "delivered") {
        blockedReasons.push("Parcel is not delivered.");
    }

    if (input.codStatus !== "collected") {
        blockedReasons.push("COD is not collected.");
    }

    if (input.collectionStatus !== "received_by_office") {
        blockedReasons.push("COD is not received by office.");
    }

    if (input.deliveryFeePayer === "merchant" && input.deliveryFeeStatus === "unpaid") {
        blockedReasons.push("Merchant delivery fee is unresolved.");
    }

    if (
        isDeliveryFeeDeducted &&
        (input.deliveryFeePayer !== "merchant" || deliveryFee <= 0 || codAmount <= deliveryFee)
    ) {
        blockedReasons.push("Delivery fee deduction is invalid.");
    }

    return {
        sourceObligationKey: `${input.parcelId}:cod_remit_credit`,
        merchantId: input.merchantId,
        sourceParcelId: input.parcelId,
        sourcePaymentRecordId: input.paymentRecordId,
        kind: "cod_remit_credit",
        direction: "company_owes_merchant",
        amount: toSettlementMoneyString(
            isDeliveryFeeDeducted ? codAmount - deliveryFee : codAmount,
        ),
        readiness: blockedReasons.length === 0 ? "ready" : "blocked",
        blockedReasons,
    };
}

function buildDeliveryFeeCharge(
    input: MerchantFinancialItemDerivationInput,
): MerchantFinancialItemDraft | null {
    if (input.deliveryFeePayer !== "merchant" || Number(input.deliveryFee) <= 0) {
        return null;
    }

    if (input.deliveryFeeStatus === "paid_by_merchant" || input.deliveryFeeStatus === "waived") {
        return null;
    }

    const blockedReasons: string[] = [];

    if (input.deliveryFeeStatus !== "bill_merchant") {
        blockedReasons.push("Delivery fee is not marked to bill the merchant.");
    }

    if (
        input.parcelStatus !== "returned" &&
        input.parcelStatus !== "cancelled" &&
        !(input.parcelType === "non_cod" && input.parcelStatus === "delivered")
    ) {
        blockedReasons.push("Parcel is not in a fee-charge settlement state.");
    }

    return {
        sourceObligationKey: `${input.parcelId}:delivery_fee_charge`,
        merchantId: input.merchantId,
        sourceParcelId: input.parcelId,
        sourcePaymentRecordId: input.paymentRecordId,
        kind: "delivery_fee_charge",
        direction: "merchant_owes_company",
        amount: toSettlementMoneyString(Number(input.deliveryFee)),
        readiness: blockedReasons.length === 0 ? "ready" : "blocked",
        blockedReasons,
    };
}

function buildRefundCredit(
    input: MerchantFinancialItemDerivationInput,
): MerchantFinancialItemDraft | null {
    if (
        input.deliveryFeePayer !== "merchant" ||
        Number(input.deliveryFee) <= 0 ||
        !refundableDeliveryFeePlans.has(
            (input.deliveryFeePaymentPlan ?? "merchant_bill_later") as
                | "merchant_prepaid_bank_transfer"
                | "merchant_cash_on_pickup"
                | "merchant_bill_later",
        )
    ) {
        return null;
    }

    if (input.parcelStatus !== "cancelled" && input.deliveryFeeStatus !== "paid_by_merchant") {
        return null;
    }

    const blockedReasons: string[] = [];

    if (input.parcelStatus !== "cancelled") {
        blockedReasons.push("Parcel is not cancelled.");
    }

    if (input.deliveryFeeStatus !== "paid_by_merchant") {
        blockedReasons.push("Refund requires verified merchant payment.");
    }

    if (
        input.deliveryFeeStatus === "paid_by_merchant" &&
        input.paymentSlipImageKeyCount === 0 &&
        input.deliveryFeePaymentPlan === "merchant_prepaid_bank_transfer"
    ) {
        blockedReasons.push("Verified refund requires a recorded payment slip.");
    }

    return {
        sourceObligationKey: `${input.parcelId}:refund_credit`,
        merchantId: input.merchantId,
        sourceParcelId: input.parcelId,
        sourcePaymentRecordId: input.paymentRecordId,
        kind: "refund_credit",
        direction: "company_owes_merchant",
        amount: toSettlementMoneyString(Number(input.deliveryFee)),
        readiness: blockedReasons.length === 0 ? "ready" : "blocked",
        blockedReasons,
    };
}

export function deriveMerchantFinancialItemDrafts(
    input: MerchantFinancialItemDerivationInput,
): MerchantFinancialItemDraft[] {
    return [
        buildCodRemitCredit(input),
        buildDeliveryFeeCharge(input),
        buildRefundCredit(input),
    ].filter((draft): draft is MerchantFinancialItemDraft => Boolean(draft));
}

export function validateSettlementSelectionRows(input: {
    expectedMerchantId: string;
    selectedIds: string[];
    selectedRows: Array<{
        id: string;
        merchantId: string;
        readiness: "ready" | "blocked";
        lifecycleState: "open" | "locked" | "closed" | "void";
    }>;
}) {
    if (input.selectedIds.length !== input.selectedRows.length) {
        return {
            ok: false as const,
            message: "Some selected settlement candidates are no longer available.",
        };
    }

    for (const row of input.selectedRows) {
        if (row.merchantId !== input.expectedMerchantId) {
            return {
                ok: false as const,
                message: "Settlement candidates must belong to the selected merchant.",
            };
        }

        if (row.lifecycleState !== "open" || row.readiness !== "ready") {
            return {
                ok: false as const,
                message: "Some selected settlement candidates are no longer ready.",
            };
        }
    }

    return { ok: true as const };
}

export function canReleaseSettlement(status: string) {
    return status === "pending" || status === "in_progress";
}

export function canMutateSettlement(status: string) {
    return status !== "paid";
}

export function getSettlementStatusAfterGeneration(direction: MerchantSettlementDirection) {
    return direction === "balanced" ? "paid" : "pending";
}

export const MERCHANT_SETTLEMENT_DIRECTIONS = MERCHANT_SETTLEMENT_TYPES;
