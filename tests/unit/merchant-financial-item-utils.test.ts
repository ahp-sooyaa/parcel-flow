import { describe, expect, it } from "vitest";
import {
    calculateSettlementSelectionSummary,
    deriveMerchantFinancialItemDrafts,
    getLegacyParcelSettlementState,
} from "../../src/features/merchant-settlements/server/merchant-financial-item-utils";

import type { MerchantFinancialItemDerivationInput } from "../../src/features/merchant-settlements/server/merchant-financial-item-dto";

const baseInput: MerchantFinancialItemDerivationInput = {
    merchantId: "00000000-0000-0000-0000-000000000010",
    parcelId: "00000000-0000-0000-0000-000000000011",
    paymentRecordId: "00000000-0000-0000-0000-000000000012",
    parcelCode: "P-1001",
    recipientName: "Receiver",
    recipientTownshipName: "Yangon",
    parcelType: "cod",
    parcelStatus: "delivered",
    deliveryFeePayer: "merchant",
    deliveryFeePaymentPlan: "merchant_deduct_from_cod_settlement",
    deliveryFeeStatus: "deduct_from_settlement",
    deliveryFee: "1000.00",
    codAmount: "10000.00",
    codStatus: "collected",
    collectionStatus: "received_by_office",
    merchantSettlementStatus: "pending",
    merchantSettlementId: null,
    paymentSlipImageKeyCount: 1,
};

describe("merchant financial item derivation", () => {
    it("derives a ready COD remit credit with settlement deduction applied", () => {
        const drafts = deriveMerchantFinancialItemDrafts(baseInput);

        expect(drafts).toContainEqual(
            expect.objectContaining({
                kind: "cod_remit_credit",
                direction: "company_owes_merchant",
                amount: "9000.00",
                readiness: "ready",
                blockedReasons: [],
            }),
        );
    });

    it("derives a ready merchant debit for bill_merchant delivery fees", () => {
        const drafts = deriveMerchantFinancialItemDrafts({
            ...baseInput,
            parcelStatus: "returned",
            deliveryFeeStatus: "bill_merchant",
        });

        expect(drafts).toContainEqual(
            expect.objectContaining({
                kind: "delivery_fee_charge",
                direction: "merchant_owes_company",
                amount: "1000.00",
                readiness: "ready",
            }),
        );
    });

    it("derives a ready merchant debit for delivered non-COD bill_merchant fees", () => {
        const drafts = deriveMerchantFinancialItemDrafts({
            ...baseInput,
            parcelType: "non_cod",
            parcelStatus: "delivered",
            deliveryFeePaymentPlan: "merchant_bill_later",
            deliveryFeeStatus: "bill_merchant",
            codStatus: "not_applicable",
            collectionStatus: "pending",
        });

        expect(drafts).toContainEqual(
            expect.objectContaining({
                kind: "delivery_fee_charge",
                direction: "merchant_owes_company",
                amount: "1000.00",
                readiness: "ready",
            }),
        );
    });

    it("keeps non-COD bill_merchant fees blocked until the parcel reaches a final outcome", () => {
        const drafts = deriveMerchantFinancialItemDrafts({
            ...baseInput,
            parcelType: "non_cod",
            parcelStatus: "out_for_delivery",
            deliveryFeePaymentPlan: "merchant_bill_later",
            deliveryFeeStatus: "bill_merchant",
            codStatus: "not_applicable",
            collectionStatus: "pending",
        });

        expect(drafts).toContainEqual(
            expect.objectContaining({
                kind: "delivery_fee_charge",
                readiness: "blocked",
                blockedReasons: ["Parcel is not in a fee-charge settlement state."],
            }),
        );
    });

    it("derives a ready refund credit only for cancelled verified prepaid fees", () => {
        const drafts = deriveMerchantFinancialItemDrafts({
            ...baseInput,
            parcelType: "non_cod",
            parcelStatus: "cancelled",
            deliveryFeePaymentPlan: "merchant_prepaid_bank_transfer",
            deliveryFeeStatus: "paid_by_merchant",
            codStatus: "not_applicable",
            collectionStatus: "pending",
        });

        expect(drafts).toContainEqual(
            expect.objectContaining({
                kind: "refund_credit",
                direction: "company_owes_merchant",
                amount: "1000.00",
                readiness: "ready",
            }),
        );
    });

    it("keeps cancelled unverified prepaid refunds blocked", () => {
        const drafts = deriveMerchantFinancialItemDrafts({
            ...baseInput,
            parcelType: "non_cod",
            parcelStatus: "cancelled",
            deliveryFeePaymentPlan: "merchant_prepaid_bank_transfer",
            deliveryFeeStatus: "unpaid",
            codStatus: "not_applicable",
            collectionStatus: "pending",
            paymentSlipImageKeyCount: 0,
        });

        expect(drafts).toContainEqual(
            expect.objectContaining({
                kind: "refund_credit",
                readiness: "blocked",
                blockedReasons: ["Refund requires verified merchant payment."],
            }),
        );
    });
});

describe("legacy parcel settlement state", () => {
    it("maps locked financial items back to in-progress parcel settlement state", () => {
        expect(
            getLegacyParcelSettlementState([
                {
                    lifecycleState: "locked",
                    merchantSettlementId: "settlement-1",
                },
            ]),
        ).toEqual({
            merchantSettlementStatus: "in_progress",
            merchantSettlementId: "settlement-1",
        });
    });

    it("keeps legacy parcel settlement pending while open candidates remain", () => {
        expect(
            getLegacyParcelSettlementState([
                {
                    lifecycleState: "closed",
                    merchantSettlementId: "settlement-1",
                },
                {
                    lifecycleState: "open",
                    merchantSettlementId: null,
                },
            ]),
        ).toEqual({
            merchantSettlementStatus: "pending",
            merchantSettlementId: null,
        });
    });

    it("maps fully closed financial items back to settled parcel state", () => {
        expect(
            getLegacyParcelSettlementState([
                {
                    lifecycleState: "closed",
                    merchantSettlementId: "settlement-1",
                },
            ]),
        ).toEqual({
            merchantSettlementStatus: "settled",
            merchantSettlementId: "settlement-1",
        });
    });
});

describe("merchant settlement selection summary", () => {
    it("produces credits, debits, and invoice direction for mixed selections", () => {
        const summary = calculateSettlementSelectionSummary([
            {
                direction: "company_owes_merchant",
                amount: "5000.00",
            },
            {
                direction: "merchant_owes_company",
                amount: "7000.00",
            },
        ]);

        expect(summary).toEqual({
            selectedCount: 2,
            creditsTotal: "5000.00",
            debitsTotal: "7000.00",
            netTotal: "-2000.00",
            direction: "invoice",
        });
    });
});
