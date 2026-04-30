import { describe, expect, it } from "vitest";
import {
    getMerchantSettlementBlockedReasons,
    isMerchantPaidDeliveryFeeUnresolved,
    calculateSettlementItemAmounts,
} from "../../src/features/merchant-settlements/server/settlement-calculations";
import {
    getParcelCorrectionOptions,
    normalizeParcelCorrectionState,
} from "../../src/features/parcels/payment-state";
import { toParcelListItemDto } from "../../src/features/parcels/server/dto";
import { validateParcelPaymentState } from "../../src/features/parcels/server/payment-guardrails";
import {
    adminCorrectParcelStateSchema,
    buildParcelWriteValues,
    createParcelBatchSchema,
    createParcelSchema,
    getDeliveryFeeResolutionOptions,
    getOfficeParcelMovementActions,
    getParcelOperationSummary,
    parseCreateParcelFormData,
    updateParcelDetailSchema,
    validateCreateParcelMedia,
    validateDeliveryFeePaymentPlan,
    validateDeliveryFeeStatusForParcel,
    validateImmutablePackageCount,
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

    it("allows delivered COD collected by rider before office reconciliation", () => {
        expect(
            validateParcelPaymentState({
                ...validState,
                deliveryFeeStatus: "unpaid",
                codStatus: "collected",
                collectionStatus: "collected_by_rider",
            }),
        ).toEqual({ ok: true });
    });

    it("allows delivered office-received COD before fee resolution", () => {
        expect(
            validateParcelPaymentState({
                ...validState,
                deliveryFeeStatus: "unpaid",
                codStatus: "collected",
                collectionStatus: "received_by_office",
            }),
        ).toEqual({ ok: true });
    });

    it("allows delivered receiver-paid fee collected from receiver", () => {
        expect(
            validateParcelPaymentState({
                ...validState,
                deliveryFeePayer: "receiver",
                deliveryFeeStatus: "collected_from_receiver",
                codStatus: "collected",
                collectionStatus: "collected_by_rider",
            }),
        ).toEqual({ ok: true });
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

    it("rejects non-COD parcels with a non-void collection status", () => {
        expect(
            validateParcelPaymentState({
                ...validState,
                parcelType: "non_cod",
                codStatus: "not_applicable",
                collectionStatus: "pending",
                deliveryFeeStatus: "bill_merchant",
            }),
        ).toMatchObject({
            ok: false,
            message: "Collection status must be 'void' when parcel type is non-COD.",
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

    it("rejects collected COD before delivery", () => {
        expect(
            validateParcelPaymentState({
                ...validState,
                parcelStatus: "pending",
                deliveryFeeStatus: "unpaid",
                codStatus: "collected",
                collectionStatus: "pending",
            }),
        ).toMatchObject({
            ok: false,
            message: "Collected COD requires a delivered parcel.",
        });
    });

    it("rejects rider-held COD cash before delivery", () => {
        expect(
            validateParcelPaymentState({
                ...validState,
                parcelStatus: "out_for_delivery",
                deliveryFeeStatus: "unpaid",
                codStatus: "collected",
                collectionStatus: "collected_by_rider",
            }),
        ).toMatchObject({
            ok: false,
            message: "Rider-held COD cash requires a delivered parcel.",
        });
    });

    it("rejects office-received COD cash before delivery", () => {
        expect(
            validateParcelPaymentState({
                ...validState,
                parcelStatus: "at_office",
                deliveryFeeStatus: "unpaid",
                codStatus: "collected",
                collectionStatus: "received_by_office",
            }),
        ).toMatchObject({
            ok: false,
            message: "Office-received COD cash requires a delivered parcel.",
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

    it("rejects rider-held cash unless COD was collected", () => {
        expect(
            validateParcelPaymentState({
                ...validState,
                deliveryFeeStatus: "unpaid",
                codStatus: "not_collected",
                collectionStatus: "collected_by_rider",
            }),
        ).toMatchObject({
            ok: false,
            message: "Rider cannot hold COD cash that was not collected.",
        });
    });

    it("rejects receiver-paid fee collection before delivery", () => {
        expect(
            validateParcelPaymentState({
                ...validState,
                parcelStatus: "pending",
                deliveryFeePayer: "receiver",
                deliveryFeeStatus: "collected_from_receiver",
                codStatus: "pending",
                collectionStatus: "pending",
            }),
        ).toMatchObject({
            ok: false,
            message: "Receiver-paid delivery fee collection requires a delivered parcel.",
        });
    });

    it("rejects impossible collected states even when a correction note would exist", () => {
        expect(
            validateParcelPaymentState({
                ...validState,
                parcelStatus: "pending",
                deliveryFeePayer: "receiver",
                deliveryFeeStatus: "collected_from_receiver",
                codStatus: "pending",
                collectionStatus: "pending",
                paymentNote: "Correcting historical parcel state.",
            }),
        ).toMatchObject({
            ok: false,
            message: "Receiver-paid delivery fee collection requires a delivered parcel.",
        });
    });

    it("rejects collected states after return or cancellation", () => {
        const invalidStates = [
            {
                parcelStatus: "returned",
                deliveryFeePayer: "merchant",
                deliveryFeeStatus: "unpaid",
                codStatus: "collected",
                collectionStatus: "pending",
                message: "Collected COD requires a delivered parcel.",
            },
            {
                parcelStatus: "returned",
                deliveryFeePayer: "merchant",
                deliveryFeeStatus: "unpaid",
                codStatus: "collected",
                collectionStatus: "collected_by_rider",
                message: "Rider-held COD cash requires a delivered parcel.",
            },
            {
                parcelStatus: "cancelled",
                deliveryFeePayer: "receiver",
                deliveryFeeStatus: "collected_from_receiver",
                codStatus: "pending",
                collectionStatus: "pending",
                message: "Receiver-paid delivery fee collection requires a delivered parcel.",
            },
        ] as const;

        for (const invalidState of invalidStates) {
            expect(
                validateParcelPaymentState({
                    ...validState,
                    ...invalidState,
                }),
            ).toMatchObject({
                ok: false,
                message: invalidState.message,
            });
        }
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

    it("parses repeated parcel rows from create form data", () => {
        const formData = new FormData();

        formData.set("merchantId", "00000000-0000-0000-0000-000000000002");
        formData.set("riderId", "");
        formData.set("recipientName", "Receiver");
        formData.set("recipientPhone", "09123456");
        formData.set("recipientTownshipId", "00000000-0000-0000-0000-000000000003");
        formData.set("recipientAddress", "Yangon");
        formData.set("deliveryFeePayer", "merchant");
        formData.set("deliveryFeePaymentPlan", "merchant_cash_on_pickup");
        formData.set("paymentNote", "Handle together");
        formData.set("parcelRows[0].parcelDescription", "Shirt");
        formData.set("parcelRows[0].packageCount", "1");
        formData.set("parcelRows[0].specialHandlingNote", "");
        formData.set("parcelRows[0].estimatedWeightKg", "");
        formData.set("parcelRows[0].packageWidthCm", "");
        formData.set("parcelRows[0].packageHeightCm", "");
        formData.set("parcelRows[0].packageLengthCm", "");
        formData.set("parcelRows[0].parcelType", "cod");
        formData.set("parcelRows[0].codAmount", "12000");
        formData.set("parcelRows[0].deliveryFee", "1500");
        formData.set("parcelRows[1].parcelDescription", "Shoes");
        formData.set("parcelRows[1].packageCount", "2");
        formData.set("parcelRows[1].specialHandlingNote", "");
        formData.set("parcelRows[1].estimatedWeightKg", "1.5");
        formData.set("parcelRows[1].packageWidthCm", "");
        formData.set("parcelRows[1].packageHeightCm", "");
        formData.set("parcelRows[1].packageLengthCm", "");
        formData.set("parcelRows[1].parcelType", "non_cod");
        formData.set("parcelRows[1].codAmount", "0");
        formData.set("parcelRows[1].deliveryFee", "1500");

        const parsed = parseCreateParcelFormData(formData);

        expect(parsed.ok).toBe(true);

        if (parsed.ok) {
            expect(parsed.data.parcelRows).toHaveLength(2);
            expect(parsed.data.parcelRows[0]).toMatchObject({
                parcelDescription: "Shirt",
                packageCount: 1,
                parcelType: "cod",
                codAmount: 12000,
                deliveryFee: 1500,
            });
            expect(parsed.data.parcelRows[1]).toMatchObject({
                parcelDescription: "Shoes",
                packageCount: 2,
                parcelType: "non_cod",
                codAmount: 0,
                deliveryFee: 1500,
            });
            expect(parsed.fields["parcelRows[1].parcelDescription"]).toBe("Shoes");
        }
    });

    it("requires at least one parcel row in batch create data", () => {
        const formData = new FormData();

        formData.set("merchantId", "00000000-0000-0000-0000-000000000002");
        formData.set("riderId", "");
        formData.set("recipientName", "Receiver");
        formData.set("recipientPhone", "09123456");
        formData.set("recipientTownshipId", "00000000-0000-0000-0000-000000000003");
        formData.set("recipientAddress", "Yangon");
        formData.set("deliveryFeePayer", "receiver");
        formData.set("deliveryFeePaymentPlan", "receiver_collect_on_delivery");
        formData.set("paymentNote", "");

        const parsed = parseCreateParcelFormData(formData);

        expect(parsed.ok).toBe(false);

        if (!parsed.ok) {
            expect(parsed.fieldErrors).toMatchObject({
                parcelRows: ["Add at least one parcel row."],
            });
        }
    });

    it("allows mixed parcel rows when the shared payment plan supports them", () => {
        const parsed = createParcelBatchSchema.safeParse({
            merchantId: "00000000-0000-0000-0000-000000000002",
            riderId: null,
            recipientName: "Receiver",
            recipientPhone: "09123456",
            recipientTownshipId: "00000000-0000-0000-0000-000000000003",
            recipientAddress: "Yangon",
            deliveryFeePayer: "merchant",
            deliveryFeePaymentPlan: "merchant_cash_on_pickup",
            paymentNote: null,
            parcelRows: [
                {
                    parcelDescription: "Shirt",
                    packageCount: 1,
                    specialHandlingNote: null,
                    estimatedWeightKg: null,
                    packageWidthCm: null,
                    packageHeightCm: null,
                    packageLengthCm: null,
                    parcelType: "cod",
                    codAmount: 12000,
                    deliveryFee: 1500,
                },
                {
                    parcelDescription: "Shoes",
                    packageCount: 2,
                    specialHandlingNote: null,
                    estimatedWeightKg: 1.5,
                    packageWidthCm: null,
                    packageHeightCm: null,
                    packageLengthCm: null,
                    parcelType: "non_cod",
                    codAmount: 0,
                    deliveryFee: 1500,
                },
            ],
        });

        expect(parsed.success).toBe(true);
    });

    it("rejects create batches whose total expanded parcel count exceeds the limit", () => {
        const parsed = createParcelBatchSchema.safeParse({
            merchantId: "00000000-0000-0000-0000-000000000002",
            riderId: null,
            recipientName: "Receiver",
            recipientPhone: "09123456",
            recipientTownshipId: "00000000-0000-0000-0000-000000000003",
            recipientAddress: "Yangon",
            deliveryFeePayer: "merchant",
            deliveryFeePaymentPlan: "merchant_cash_on_pickup",
            paymentNote: null,
            parcelRows: [
                {
                    parcelDescription: "Shirt",
                    packageCount: 20,
                    specialHandlingNote: null,
                    estimatedWeightKg: null,
                    packageWidthCm: null,
                    packageHeightCm: null,
                    packageLengthCm: null,
                    parcelType: "cod",
                    codAmount: 12000,
                    deliveryFee: 1500,
                },
                {
                    parcelDescription: "Shoes",
                    packageCount: 1,
                    specialHandlingNote: null,
                    estimatedWeightKg: null,
                    packageWidthCm: null,
                    packageHeightCm: null,
                    packageLengthCm: null,
                    parcelType: "non_cod",
                    codAmount: 0,
                    deliveryFee: 1500,
                },
            ],
        });

        expect(parsed.success).toBe(false);

        if (!parsed.success) {
            expect(parsed.error.issues).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        path: ["parcelRows"],
                        message:
                            "You can create up to 20 parcels at once. Reduce the package counts.",
                    }),
                ]),
            );
        }
    });

    it("rejects non-cod rows for deduct-from-settlement batches", () => {
        const parsed = createParcelBatchSchema.safeParse({
            merchantId: "00000000-0000-0000-0000-000000000002",
            riderId: null,
            recipientName: "Receiver",
            recipientPhone: "09123456",
            recipientTownshipId: "00000000-0000-0000-0000-000000000003",
            recipientAddress: "Yangon",
            deliveryFeePayer: "merchant",
            deliveryFeePaymentPlan: "merchant_deduct_from_cod_settlement",
            paymentNote: null,
            parcelRows: [
                {
                    parcelDescription: "Shirt",
                    packageCount: 1,
                    specialHandlingNote: null,
                    estimatedWeightKg: null,
                    packageWidthCm: null,
                    packageHeightCm: null,
                    packageLengthCm: null,
                    parcelType: "cod",
                    codAmount: 12000,
                    deliveryFee: 1500,
                },
                {
                    parcelDescription: "Shoes",
                    packageCount: 2,
                    specialHandlingNote: null,
                    estimatedWeightKg: null,
                    packageWidthCm: null,
                    packageHeightCm: null,
                    packageLengthCm: null,
                    parcelType: "non_cod",
                    codAmount: 0,
                    deliveryFee: 1500,
                },
            ],
        });

        expect(parsed.success).toBe(false);

        if (!parsed.success) {
            expect(parsed.error.issues).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        path: ["parcelRows", 1, "parcelType"],
                        message: "Deduct from COD settlement requires a COD parcel.",
                    }),
                ]),
            );
        }
    });

    it("normalizes non-cod row cod amount to zero when building write values", () => {
        const parsed = createParcelSchema.parse({
            merchantId: "00000000-0000-0000-0000-000000000002",
            riderId: "",
            recipientName: "Receiver",
            recipientPhone: "09123456",
            recipientTownshipId: "00000000-0000-0000-0000-000000000003",
            recipientAddress: "Yangon",
            parcelDescription: "Shoes",
            packageCount: "1",
            specialHandlingNote: "",
            estimatedWeightKg: "",
            packageWidthCm: "",
            packageHeightCm: "",
            packageLengthCm: "",
            parcelType: "non_cod",
            codAmount: "9999",
            deliveryFee: "1500",
            deliveryFeePayer: "receiver",
            deliveryFeePaymentPlan: "receiver_collect_on_delivery",
            paymentNote: "",
        });

        const values = buildParcelWriteValues({
            data: parsed,
            merchantId: parsed.merchantId,
            riderId: parsed.riderId,
            totalAmountToCollect: 1500,
            deliveryFeePaymentPlan: parsed.deliveryFeePaymentPlan,
            parcelStatus: "pending",
            pickupImageKeys: [],
            proofOfDeliveryImageKeys: [],
        });

        expect(values.codAmount).toBe("0.00");
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
    deliveryFeePaymentPlan: "merchant_deduct_from_cod_settlement",
    deliveryFeeStatus: "deduct_from_settlement",
    codStatus: "collected",
    collectedAmount: "10000.00",
    collectionStatus: "received_by_office",
    merchantSettlementStatus: "pending",
    merchantSettlementId: null,
    paymentNote: null,
} satisfies Parameters<typeof getParcelOperationSummary>[0];

const validCorrectionState = {
    parcelType: "cod",
    parcelStatus: "delivered",
    deliveryFeePayer: "merchant",
    deliveryFeePaymentPlan: "merchant_deduct_from_cod_settlement",
    codAmount: 10000,
    deliveryFee: 1000,
    deliveryFeeStatus: "deduct_from_settlement",
    previousDeliveryFeeStatus: "deduct_from_settlement",
    codStatus: "collected",
    collectionStatus: "received_by_office",
    merchantSettlementStatus: "pending",
    merchantSettlementId: null,
    paymentNote: null,
} satisfies Parameters<typeof normalizeParcelCorrectionState>[0];

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

    it("allows delivery fee statuses that match the payment plan", () => {
        const validPlanStates = [
            {
                deliveryFeePayer: "merchant",
                deliveryFeePaymentPlan: "merchant_prepaid_bank_transfer",
                parcelStatus: "pending",
                deliveryFeeStatus: "paid_by_merchant",
            },
            {
                deliveryFeePayer: "merchant",
                deliveryFeePaymentPlan: "merchant_cash_on_pickup",
                parcelStatus: "out_for_pickup",
                deliveryFeeStatus: "paid_by_merchant",
            },
            {
                deliveryFeePayer: "merchant",
                deliveryFeePaymentPlan: "merchant_bill_later",
                parcelStatus: "out_for_delivery",
                deliveryFeeStatus: "bill_merchant",
            },
            {
                deliveryFeePayer: "receiver",
                deliveryFeePaymentPlan: "receiver_collect_on_delivery",
                parcelStatus: "delivered",
                deliveryFeeStatus: "collected_from_receiver",
            },
            {
                deliveryFeePayer: "merchant",
                deliveryFeePaymentPlan: "merchant_deduct_from_cod_settlement",
                parcelStatus: "delivered",
                deliveryFeeStatus: "deduct_from_settlement",
            },
            {
                deliveryFeePayer: "merchant",
                deliveryFeePaymentPlan: "merchant_deduct_from_cod_settlement",
                parcelStatus: "returned",
                deliveryFeeStatus: "bill_merchant",
            },
        ] as const;

        for (const state of validPlanStates) {
            expect(validateDeliveryFeeStatusForParcel(state)).toEqual({ ok: true });
        }
    });

    it("rejects delivery fee statuses that do not match the payment plan", () => {
        const invalidPlanStates = [
            {
                deliveryFeePayer: "merchant",
                deliveryFeePaymentPlan: "merchant_prepaid_bank_transfer",
                parcelStatus: "delivered",
                deliveryFeeStatus: "bill_merchant",
            },
            {
                deliveryFeePayer: "merchant",
                deliveryFeePaymentPlan: "merchant_prepaid_bank_transfer",
                parcelStatus: "delivered",
                deliveryFeeStatus: "deduct_from_settlement",
            },
            {
                deliveryFeePayer: "merchant",
                deliveryFeePaymentPlan: "merchant_bill_later",
                parcelStatus: "delivered",
                deliveryFeeStatus: "paid_by_merchant",
            },
            {
                deliveryFeePayer: "receiver",
                deliveryFeePaymentPlan: "receiver_collect_on_delivery",
                parcelStatus: "delivered",
                deliveryFeeStatus: "bill_merchant",
            },
            {
                deliveryFeePayer: "merchant",
                deliveryFeePaymentPlan: "merchant_deduct_from_cod_settlement",
                parcelStatus: "delivered",
                deliveryFeeStatus: "paid_by_merchant",
            },
            {
                deliveryFeePayer: "merchant",
                deliveryFeePaymentPlan: "merchant_deduct_from_cod_settlement",
                parcelStatus: "returned",
                deliveryFeeStatus: "deduct_from_settlement",
            },
        ] as const;

        for (const state of invalidPlanStates) {
            expect(validateDeliveryFeeStatusForParcel(state)).toMatchObject({ ok: false });
        }
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

    it("shows settled for non-COD parcels that were included in merchant settlement", () => {
        expect(
            getParcelOperationSummary({
                ...validOperationState,
                parcelType: "non_cod",
                codAmount: "0.00",
                deliveryFeePaymentPlan: "merchant_bill_later",
                deliveryFeeStatus: "bill_merchant",
                codStatus: "not_applicable",
                collectionStatus: "void",
                merchantSettlementStatus: "settled",
                merchantSettlementId: "00000000-0000-0000-0000-000000000001",
            }),
        ).toMatchObject({
            cash: {
                label: "Not applicable",
            },
            settlement: {
                label: "Settled",
            },
        });
    });

    it("only exposes settlement deduction when guardrail conditions are satisfied", () => {
        expect(
            getDeliveryFeeResolutionOptions({
                ...validOperationState,
                deliveryFeePaymentPlan: "merchant_prepaid_bank_transfer",
                deliveryFeeStatus: "unpaid",
            }),
        ).toEqual(["paid_by_merchant", "waived"]);

        expect(
            getDeliveryFeeResolutionOptions({
                ...validOperationState,
                deliveryFeePaymentPlan: "merchant_cash_on_pickup",
                deliveryFeeStatus: "unpaid",
            }),
        ).toEqual(["paid_by_merchant", "waived"]);

        expect(
            getDeliveryFeeResolutionOptions({
                ...validOperationState,
                deliveryFeePaymentPlan: "merchant_bill_later",
                deliveryFeeStatus: "unpaid",
            }),
        ).toEqual(["bill_merchant", "waived"]);

        expect(
            getDeliveryFeeResolutionOptions({
                ...validOperationState,
                deliveryFeePayer: "receiver",
                deliveryFeePaymentPlan: "receiver_collect_on_delivery",
                deliveryFeeStatus: "unpaid",
            }),
        ).toEqual(["collected_from_receiver", "waived"]);

        expect(
            getDeliveryFeeResolutionOptions({
                ...validOperationState,
                parcelStatus: "out_for_delivery",
                deliveryFeePayer: "receiver",
                deliveryFeePaymentPlan: "receiver_collect_on_delivery",
                deliveryFeeStatus: "unpaid",
                codStatus: "pending",
                collectionStatus: "pending",
            }),
        ).toEqual(["waived"]);

        expect(
            getDeliveryFeeResolutionOptions({
                ...validOperationState,
                deliveryFeePaymentPlan: "merchant_deduct_from_cod_settlement",
                deliveryFeeStatus: "unpaid",
            }),
        ).toEqual(["deduct_from_settlement", "waived"]);

        expect(
            getDeliveryFeeResolutionOptions({
                ...validOperationState,
                deliveryFeePaymentPlan: "merchant_deduct_from_cod_settlement",
                parcelStatus: "returned",
                deliveryFeeStatus: "unpaid",
                codStatus: "not_collected",
                collectionStatus: "not_collected",
            }),
        ).toEqual(["bill_merchant", "waived"]);

        expect(
            getDeliveryFeeResolutionOptions({
                ...validOperationState,
                deliveryFeePaymentPlan: "merchant_deduct_from_cod_settlement",
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

    it("rejects attempts to change a saved parcel package count", () => {
        expect(
            validateImmutablePackageCount({
                currentPackageCount: 1,
                submittedPackageCount: 2,
            }),
        ).toMatchObject({
            ok: false,
            message: "Package count cannot be changed after parcel creation.",
            fieldErrors: {
                packageCount: ["Package count cannot be changed after parcel creation."],
            },
        });
    });

    it("allows updates when the saved parcel package count is unchanged", () => {
        expect(
            validateImmutablePackageCount({
                currentPackageCount: 2,
                submittedPackageCount: 2,
            }),
        ).toEqual({ ok: true });
    });

    it("normalizes legacy non-COD payment display state", () => {
        expect(
            toParcelListItemDto({
                id: "00000000-0000-0000-0000-000000000001",
                parcelCode: "PF-240101-000001",
                merchantId: "00000000-0000-0000-0000-000000000002",
                riderId: null,
                merchantLabel: "Merchant",
                recipientName: "Receiver",
                recipientPhone: "09123456",
                recipientTownshipName: "Yangon",
                parcelType: "non_cod",
                codAmount: "0.00",
                deliveryFee: "1000.00",
                totalAmountToCollect: "1000.00",
                deliveryFeePayer: "merchant",
                deliveryFeePaymentPlan: "merchant_bill_later",
                parcelStatus: "delivered",
                deliveryFeeStatus: "bill_merchant",
                codStatus: "pending",
                collectedAmount: "0.00",
                collectionStatus: "pending",
                merchantSettlementStatus: "pending",
                merchantSettlementId: null,
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
            }),
        ).toMatchObject({
            codStatus: "not_applicable",
            collectionStatus: "void",
        });
    });
});

describe("parcel correction options", () => {
    it("hides receiver collection until the parcel is delivered", () => {
        expect(
            getParcelCorrectionOptions({
                ...validCorrectionState,
                parcelStatus: "out_for_delivery",
                deliveryFeePayer: "receiver",
                deliveryFeePaymentPlan: "receiver_collect_on_delivery",
                deliveryFeeStatus: "unpaid",
                codStatus: "pending",
                collectionStatus: "pending",
            }).deliveryFeeStatuses,
        ).toEqual(["unpaid", "waived"]);
    });

    it("removes collected cash statuses before delivery", () => {
        const options = getParcelCorrectionOptions({
            ...validCorrectionState,
            parcelStatus: "out_for_delivery",
            deliveryFeeStatus: "unpaid",
            codStatus: "pending",
            collectionStatus: "pending",
        });

        expect(options.codStatuses).not.toContain("collected");
        expect(options.collectionStatuses).toEqual(["pending", "not_collected", "void"]);
    });

    it("normalizes an invalid correction draft to the closest valid combination", () => {
        expect(
            normalizeParcelCorrectionState({
                ...validCorrectionState,
                parcelStatus: "pending",
                deliveryFeePayer: "receiver",
                deliveryFeePaymentPlan: "receiver_collect_on_delivery",
                deliveryFeeStatus: "collected_from_receiver",
                codStatus: "collected",
                collectionStatus: "collected_by_rider",
            }),
        ).toEqual({
            parcelStatus: "delivered",
            deliveryFeeStatus: "collected_from_receiver",
            codStatus: "collected",
            collectionStatus: "collected_by_rider",
        });
    });
});
