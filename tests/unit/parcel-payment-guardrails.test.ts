import { describe, expect, it } from "vitest";
import {
    getMerchantSettlementBlockedReasons,
    isMerchantPaidDeliveryFeeUnresolved,
    calculateSettlementItemAmounts,
} from "../../src/features/merchant-settlements/server/settlement-calculations";
import { validateParcelPaymentState } from "../../src/features/parcels/server/payment-guardrails";
import {
    adminCorrectParcelStateSchema,
    createParcelSchema,
    getDeliveryFeeResolutionOptions,
    getOfficeParcelMovementActions,
    getParcelOperationSummary,
    updateParcelDetailSchema,
    validateCreateParcelMedia,
    validateDeliveryFeePaymentPlan,
    validateParcelStatusProofImages,
    validatePaymentSlipImagesForPlan,
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

describe("delivery fee payment plan guardrails", () => {
    it("allows all valid create-time payment plans", () => {
        const validPlans = [
            {
                parcelType: "cod",
                deliveryFeePayer: "receiver",
                deliveryFeePaymentPlan: "receiver_collect_on_delivery",
            },
            {
                parcelType: "cod",
                deliveryFeePayer: "merchant",
                deliveryFeePaymentPlan: "merchant_prepaid_bank_transfer",
            },
            {
                parcelType: "cod",
                deliveryFeePayer: "merchant",
                deliveryFeePaymentPlan: "merchant_cash_on_pickup",
            },
            {
                parcelType: "cod",
                deliveryFeePayer: "merchant",
                deliveryFeePaymentPlan: "merchant_deduct_from_cod_settlement",
            },
            {
                parcelType: "non_cod",
                deliveryFeePayer: "merchant",
                deliveryFeePaymentPlan: "merchant_bill_later",
            },
        ] as const;

        for (const plan of validPlans) {
            expect(
                validateDeliveryFeePaymentPlan({
                    ...plan,
                    requireRecordedPlan: true,
                }),
            ).toEqual({ ok: true });
        }
    });

    it("rejects payer and parcel type mismatches", () => {
        expect(
            validateDeliveryFeePaymentPlan({
                parcelType: "cod",
                deliveryFeePayer: "receiver",
                deliveryFeePaymentPlan: "merchant_cash_on_pickup",
                requireRecordedPlan: true,
            }),
        ).toMatchObject({ ok: false });
        expect(
            validateDeliveryFeePaymentPlan({
                parcelType: "cod",
                deliveryFeePayer: "merchant",
                deliveryFeePaymentPlan: "receiver_collect_on_delivery",
                requireRecordedPlan: true,
            }),
        ).toMatchObject({ ok: false });
        expect(
            validateDeliveryFeePaymentPlan({
                parcelType: "non_cod",
                deliveryFeePayer: "merchant",
                deliveryFeePaymentPlan: "merchant_deduct_from_cod_settlement",
                requireRecordedPlan: true,
            }),
        ).toMatchObject({ ok: false });
    });

    it("allows legacy null plans on update but requires a plan in new create input", () => {
        expect(
            validateDeliveryFeePaymentPlan({
                parcelType: "cod",
                deliveryFeePayer: "receiver",
                deliveryFeePaymentPlan: null,
            }),
        ).toEqual({ ok: true });

        const parsed = createParcelSchema.safeParse({
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
            deliveryFeePayer: "receiver",
            paymentNote: "",
        });

        expect(parsed.success).toBe(false);

        const updateParsed = updateParcelDetailSchema.safeParse({
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
            deliveryFeePayer: "receiver",
            deliveryFeePaymentPlan: "",
        });

        expect(updateParsed.success).toBe(true);

        if (updateParsed.success) {
            expect(updateParsed.data.deliveryFeePaymentPlan).toBeNull();
        }
    });

    it("allows payment slips only for prepaid bank transfer", () => {
        const imageFile = {} as File;

        expect(
            validatePaymentSlipImagesForPlan({
                deliveryFeePaymentPlan: "merchant_prepaid_bank_transfer",
                paymentSlipImages: [imageFile],
            }),
        ).toEqual({ ok: true });
        expect(
            validatePaymentSlipImagesForPlan({
                deliveryFeePaymentPlan: "merchant_cash_on_pickup",
                paymentSlipImages: [imageFile],
            }),
        ).toMatchObject({
            ok: false,
            fieldErrors: {
                paymentSlipImages: ["Payment slips are only allowed for prepaid bank transfer."],
            },
        });
    });

    it("rejects pickup and proof images during parcel create", () => {
        const imageFile = {} as File;
        const emptyFiles = {
            pickupImages: [],
            proofOfDeliveryImages: [],
            paymentSlipImages: [],
        };

        expect(
            validateCreateParcelMedia({
                deliveryFeePaymentPlan: "receiver_collect_on_delivery",
                files: {
                    ...emptyFiles,
                    pickupImages: [imageFile],
                },
            }),
        ).toMatchObject({
            ok: false,
            fieldErrors: {
                pickupImages: ["Upload pickup images after pickup starts."],
            },
        });
        expect(
            validateCreateParcelMedia({
                deliveryFeePaymentPlan: "receiver_collect_on_delivery",
                files: {
                    ...emptyFiles,
                    proofOfDeliveryImages: [imageFile],
                },
            }),
        ).toMatchObject({
            ok: false,
            fieldErrors: {
                proofOfDeliveryImages: ["Upload proof of delivery images after delivery."],
            },
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

    it("requires pickup proof before marking a parcel at office", () => {
        expect(
            validateParcelStatusProofImages({
                nextStatus: "at_office",
                pickupImageKeys: [],
                proofOfDeliveryImageKeys: [],
            }),
        ).toMatchObject({
            ok: false,
            fieldErrors: {
                pickupImages: ["Upload at least one pickup image before marking parcel at office."],
            },
        });

        expect(
            validateParcelStatusProofImages({
                nextStatus: "at_office",
                pickupImageKeys: ["pickup/1.jpg"],
                proofOfDeliveryImageKeys: [],
            }),
        ).toEqual({ ok: true });
    });

    it("requires proof of delivery before marking a parcel delivered", () => {
        expect(
            validateParcelStatusProofImages({
                nextStatus: "delivered",
                pickupImageKeys: ["pickup/1.jpg"],
                proofOfDeliveryImageKeys: [],
            }),
        ).toMatchObject({
            ok: false,
            fieldErrors: {
                proofOfDeliveryImages: [
                    "Upload at least one proof of delivery image before marking parcel delivered.",
                ],
            },
        });

        expect(
            validateParcelStatusProofImages({
                nextStatus: "delivered",
                pickupImageKeys: ["pickup/1.jpg"],
                proofOfDeliveryImageKeys: ["proof/1.jpg"],
            }),
        ).toEqual({ ok: true });
    });

    it("does not require proof images for unrelated status changes", () => {
        expect(
            validateParcelStatusProofImages({
                nextStatus: "out_for_delivery",
                pickupImageKeys: [],
                proofOfDeliveryImageKeys: [],
            }),
        ).toEqual({ ok: true });
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
            deliveryFeePaymentPlan: "merchant_bill_later",
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
            expect(parsed.data.deliveryFeePaymentPlan).toBe("merchant_bill_later");
            expect("codStatus" in parsed.data).toBe(false);
            expect("collectionStatus" in parsed.data).toBe(false);
            expect("collectedAmount" in parsed.data).toBe(false);
        }
    });
});
