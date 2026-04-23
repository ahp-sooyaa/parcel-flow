import { describe, expect, it } from "vitest";
import {
    getMerchantSettlementBlockedReasons,
    isMerchantPaidDeliveryFeeUnresolved,
    calculateSettlementItemAmounts,
} from "../../src/features/merchant-settlements/server/settlement-calculations";
import { validateParcelPaymentState } from "../../src/features/parcels/server/payment-guardrails";
import {
    adminCorrectParcelStateSchema,
    getDeliveryFeeResolutionOptions,
    getOfficeParcelMovementActions,
    getParcelOperationSummary,
    updateParcelDetailSchema,
} from "../../src/features/parcels/server/utils";

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

const validOperationState = {
    parcelType: "cod",
    parcelStatus: "delivered",
    codAmount: "10000.00",
    deliveryFee: "1000.00",
    totalAmountToCollect: "10000.00",
    deliveryFeePayer: "merchant",
    deliveryFeeStatus: "deduct_from_settlement",
    codStatus: "collected",
    collectedAmount: "10000.00",
    collectionStatus: "received_by_office",
    merchantSettlementStatus: "pending",
    merchantSettlementId: null,
    paymentNote: null,
} satisfies Parameters<typeof getParcelOperationSummary>[0];

describe("parcel operation helpers", () => {
    it("returns valid office movement actions by status", () => {
        expect(
            getOfficeParcelMovementActions({
                ...validOperationState,
                parcelStatus: "pending",
            }),
        ).toEqual([{ label: "Start Pickup", nextStatus: "out_for_pickup" }]);
        expect(
            getOfficeParcelMovementActions({
                ...validOperationState,
                parcelStatus: "out_for_delivery",
            }),
        ).toEqual([
            { label: "Mark Delivered", nextStatus: "delivered" },
            { label: "Return To Office", nextStatus: "return_to_office" },
        ]);
    });

    it("does not return movement actions for terminal or locked states", () => {
        expect(
            getOfficeParcelMovementActions({
                ...validOperationState,
                parcelStatus: "returned",
            }),
        ).toEqual([]);
        expect(
            getOfficeParcelMovementActions({
                ...validOperationState,
                parcelStatus: "delivered",
                merchantSettlementStatus: "in_progress",
                merchantSettlementId: "00000000-0000-0000-0000-000000000001",
            }),
        ).toEqual([]);
    });

    it("shows receive cash for delivered COD held by rider", () => {
        expect(
            getParcelOperationSummary({
                ...validOperationState,
                deliveryFeeStatus: "unpaid",
                collectionStatus: "collected_by_rider",
            }),
        ).toMatchObject({
            cash: {
                canReceiveAtOffice: true,
                label: "Receive rider cash",
            },
            primaryActionLabel: "Receive Cash",
        });
    });

    it("shows resolve fee for office-received merchant-paid unpaid delivery fee", () => {
        expect(
            getParcelOperationSummary({
                ...validOperationState,
                deliveryFeeStatus: "unpaid",
            }),
        ).toMatchObject({
            deliveryFee: {
                canResolve: true,
                label: "Resolve fee",
            },
            primaryActionLabel: "Resolve Fee",
        });
    });

    it("suppresses financial operations for locked settlement states", () => {
        expect(
            getParcelOperationSummary({
                ...validOperationState,
                deliveryFeeStatus: "unpaid",
                merchantSettlementStatus: "in_progress",
                merchantSettlementId: "00000000-0000-0000-0000-000000000001",
            }),
        ).toMatchObject({
            deliveryFee: {
                canResolve: false,
            },
            settlement: {
                label: "Locked by settlement",
            },
        });
    });

    it("only exposes settlement deduction when guardrail conditions are satisfied", () => {
        expect(
            getDeliveryFeeResolutionOptions({
                ...validOperationState,
                deliveryFeeStatus: "unpaid",
            }),
        ).toContain("deduct_from_settlement");
        expect(
            getDeliveryFeeResolutionOptions({
                ...validOperationState,
                parcelStatus: "at_office",
                deliveryFeeStatus: "unpaid",
                collectionStatus: "pending",
            }),
        ).not.toContain("deduct_from_settlement");
    });

    it("requires an admin correction note", () => {
        expect(
            adminCorrectParcelStateSchema.safeParse({
                parcelId: "00000000-0000-0000-0000-000000000001",
                parcelStatus: "delivered",
                deliveryFeeStatus: "paid_by_merchant",
                codStatus: "collected",
                collectionStatus: "received_by_office",
                collectedAmount: "10000",
                paymentNote: "",
                correctionNote: "",
            }).success,
        ).toBe(false);
    });

    it("strips operation and payment fields from parcel detail edits", () => {
        const parsed = updateParcelDetailSchema.safeParse({
            parcelId: "00000000-0000-0000-0000-000000000001",
            merchantId: "00000000-0000-0000-0000-000000000002",
            riderId: "",
            recipientName: "Receiver",
            recipientPhone: "09123456",
            recipientTownshipId: "00000000-0000-0000-0000-000000000003",
            recipientAddress: "Yangon",
            parcelDescription: "Box",
            packageCount: "1",
            specialHandlingNote: "",
            estimatedWeightKg: "",
            packageWidthCm: "",
            packageHeightCm: "",
            packageLengthCm: "",
            parcelType: "cod",
            codAmount: "10000",
            deliveryFee: "1000",
            deliveryFeePayer: "merchant",
            parcelStatus: "cancelled",
            deliveryFeeStatus: "waived",
            codStatus: "not_collected",
            collectionStatus: "void",
            collectedAmount: "0",
        });

        expect(parsed.success).toBe(true);

        if (parsed.success) {
            expect("parcelStatus" in parsed.data).toBe(false);
            expect("deliveryFeeStatus" in parsed.data).toBe(false);
            expect("codStatus" in parsed.data).toBe(false);
            expect("collectionStatus" in parsed.data).toBe(false);
            expect("collectedAmount" in parsed.data).toBe(false);
        }
    });
});
