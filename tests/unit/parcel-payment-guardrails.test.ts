import { describe, expect, it } from "vitest";
import {
    getMerchantSettlementBlockedReasons,
    isMerchantPaidDeliveryFeeUnresolved,
    calculateSettlementItemAmounts,
} from "../../src/features/merchant-settlements/server/settlement-calculations";
import { validateParcelPaymentState } from "../../src/features/parcels/server/payment-guardrails";

const validState = {
    parcelType: "cod",
    parcelStatus: "delivered",
    deliveryFeePayer: "merchant",
    codAmount: 10000,
    deliveryFee: 1000,
    deliveryFeeStatus: "deduct_from_settlement",
    codStatus: "collected",
    collectionStatus: "received_by_office",
    merchantSettlementStatus: "pending",
    merchantSettlementId: null,
    paymentNote: null,
} satisfies Parameters<typeof validateParcelPaymentState>[0];

describe("parcel payment guardrails", () => {
    it("allows a fully resolved settlement deduction state", () => {
        expect(validateParcelPaymentState(validState)).toEqual({ ok: true });
    });

    it("rejects settlement deduction before COD reaches office", () => {
        expect(
            validateParcelPaymentState({
                ...validState,
                collectionStatus: "collected_by_rider",
            }),
        ).toMatchObject({
            ok: false,
            message: "Delivery fee deduction requires COD received by office.",
        });
    });

    it("allows an existing settlement deduction after settlement locking", () => {
        expect(
            validateParcelPaymentState({
                ...validState,
                previousDeliveryFeeStatus: "deduct_from_settlement",
                merchantSettlementStatus: "in_progress",
                merchantSettlementId: "00000000-0000-0000-0000-000000000001",
            }),
        ).toEqual({ ok: true });
    });

    it("rejects a new settlement deduction after settlement locking", () => {
        expect(
            validateParcelPaymentState({
                ...validState,
                previousDeliveryFeeStatus: "unpaid",
                merchantSettlementStatus: "in_progress",
                merchantSettlementId: "00000000-0000-0000-0000-000000000001",
            }),
        ).toMatchObject({
            ok: false,
            message: "Delivery fee deduction is only allowed before merchant settlement locking.",
        });
    });

    it("rejects COD status on non-COD parcels", () => {
        expect(
            validateParcelPaymentState({
                ...validState,
                parcelType: "non_cod",
                codStatus: "collected",
                deliveryFeeStatus: "unpaid",
            }),
        ).toMatchObject({
            ok: false,
            message: "COD status must be 'not_applicable' when parcel type is non-COD.",
        });
    });

    it("rejects delivered COD parcels with pending COD state", () => {
        expect(
            validateParcelPaymentState({
                ...validState,
                deliveryFeeStatus: "unpaid",
                codStatus: "pending",
                collectionStatus: "pending",
            }),
        ).toMatchObject({
            ok: false,
            message: "Delivered COD parcels must have COD collection resolved.",
        });
    });

    it("rejects office-received cash unless COD was collected", () => {
        expect(
            validateParcelPaymentState({
                ...validState,
                deliveryFeeStatus: "unpaid",
                codStatus: "not_collected",
                collectionStatus: "received_by_office",
            }),
        ).toMatchObject({
            ok: false,
            message: "Office cannot receive COD that was not collected.",
        });
    });

    it("requires a note when delivery fee is waived", () => {
        expect(
            validateParcelPaymentState({
                ...validState,
                deliveryFeeStatus: "waived",
                paymentNote: "",
            }),
        ).toMatchObject({
            ok: false,
            message: "Waived delivery fees require a payment note.",
        });
    });
});

describe("merchant settlement guardrails", () => {
    it("blocks merchant-paid unresolved delivery fees only", () => {
        expect(
            isMerchantPaidDeliveryFeeUnresolved({
                deliveryFeePayer: "merchant",
                deliveryFeeStatus: "unpaid",
            }),
        ).toBe(true);
        expect(
            isMerchantPaidDeliveryFeeUnresolved({
                deliveryFeePayer: "receiver",
                deliveryFeeStatus: "unpaid",
            }),
        ).toBe(false);
    });

    it("deducts delivery fee only when the parcel status says to deduct", () => {
        expect(
            calculateSettlementItemAmounts({
                codAmount: "10000.00",
                deliveryFee: "1000.00",
                deliveryFeeStatus: "deduct_from_settlement",
            }),
        ).toMatchObject({
            isDeliveryFeeDeducted: true,
            netPayableAmount: "9000.00",
        });
        expect(
            calculateSettlementItemAmounts({
                codAmount: "10000.00",
                deliveryFee: "1000.00",
                deliveryFeeStatus: "bill_merchant",
            }),
        ).toMatchObject({
            isDeliveryFeeDeducted: false,
            netPayableAmount: "10000.00",
        });
    });

    it("returns blocked settlement reasons for unresolved COD parcels", () => {
        expect(
            getMerchantSettlementBlockedReasons({
                parcelStatus: "out_for_delivery",
                codStatus: "pending",
                codAmount: "10000.00",
                deliveryFee: "1000.00",
                collectionStatus: "pending",
                deliveryFeePayer: "merchant",
                deliveryFeeStatus: "unpaid",
                merchantSettlementStatus: "pending",
                merchantSettlementId: null,
            }),
        ).toEqual([
            "Parcel is not delivered.",
            "COD not collected.",
            "COD not received by office.",
            "Delivery fee is unresolved.",
        ]);
    });
});
