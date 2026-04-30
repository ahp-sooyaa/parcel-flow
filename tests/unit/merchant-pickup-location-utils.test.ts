import { describe, expect, it } from "vitest";
import {
    normalizeMerchantPickupLocationLabel,
    pickupLocationReferenceSchema,
} from "../../src/features/merchant-pickup-locations/server/utils";
import {
    buildParcelWriteValues,
    parseCreateParcelFormData,
} from "../../src/features/parcels/server/utils";

describe("merchant pickup location helpers", () => {
    it("normalizes labels by trimming and lowercasing", () => {
        expect(normalizeMerchantPickupLocationLabel("  Main Shop  ")).toBe("main shop");
    });

    it("accepts one-time pickup details without a saved pickup location id", () => {
        const parsed = pickupLocationReferenceSchema.safeParse({
            pickupLocationId: "",
            pickupLocationLabel: "Main Shop",
            pickupTownshipId: "00000000-0000-0000-0000-000000000010",
            pickupAddress: "No. 5, Merchant Street",
            savePickupLocation: "false",
        });

        expect(parsed.success).toBe(true);
        expect(parsed.data).toEqual({
            pickupLocationId: null,
            pickupLocationLabel: "Main Shop",
            pickupTownshipId: "00000000-0000-0000-0000-000000000010",
            pickupAddress: "No. 5, Merchant Street",
            savePickupLocation: false,
        });
    });

    it("parses create parcel pickup address-book fields from form data", () => {
        const formData = new FormData();

        formData.set("merchantId", "00000000-0000-0000-0000-000000000001");
        formData.set("riderId", "");
        formData.set("pickupLocationId", "");
        formData.set("pickupLocationLabel", "Temporary Pickup");
        formData.set("pickupTownshipId", "00000000-0000-0000-0000-000000000002");
        formData.set("pickupAddress", "No. 7, Example Road");
        formData.set("savePickupLocation", "on");
        formData.set("selectedMerchantContactId", "");
        formData.set("contactLabel", "");
        formData.set("saveRecipientContact", "false");
        formData.set("recipientName", "Ko Aung");
        formData.set("recipientPhone", "0912345678");
        formData.set("recipientTownshipId", "00000000-0000-0000-0000-000000000003");
        formData.set("recipientAddress", "No. 1, Example Street");
        formData.set("deliveryFeePayer", "receiver");
        formData.set("deliveryFeePaymentPlan", "receiver_collect_on_delivery");
        formData.set("paymentNote", "");
        formData.set("parcelRows[0].parcelDescription", "T-shirt");
        formData.set("parcelRows[0].packageCount", "1");
        formData.set("parcelRows[0].specialHandlingNote", "");
        formData.set("parcelRows[0].estimatedWeightKg", "1.00");
        formData.set("parcelRows[0].isLargeItem", "false");
        formData.set("parcelRows[0].packageWidthCm", "");
        formData.set("parcelRows[0].packageHeightCm", "");
        formData.set("parcelRows[0].packageLengthCm", "");
        formData.set("parcelRows[0].parcelType", "cod");
        formData.set("parcelRows[0].codAmount", "1000");
        formData.set("parcelRows[0].deliveryFee", "500");

        const parsed = parseCreateParcelFormData(formData);

        expect(parsed.ok).toBe(true);
        if (!parsed.ok) {
            return;
        }

        expect(parsed.data.pickupLocationId).toBeNull();
        expect(parsed.data.pickupLocationLabel).toBe("Temporary Pickup");
        expect(parsed.data.pickupTownshipId).toBe("00000000-0000-0000-0000-000000000002");
        expect(parsed.data.pickupAddress).toBe("No. 7, Example Road");
        expect(parsed.data.savePickupLocation).toBe(true);
    });

    it("writes one-time pickup snapshots without a saved pickup location id", () => {
        const parcelWriteValues = buildParcelWriteValues({
            data: {
                merchantId: "00000000-0000-0000-0000-000000000001",
                riderId: null,
                recipientName: "Ma Su",
                recipientPhone: "0998765432",
                recipientTownshipId: "00000000-0000-0000-0000-000000000003",
                recipientAddress: "No. 2, Example Street",
                parcelDescription: "Shoes",
                packageCount: 1,
                specialHandlingNote: null,
                estimatedWeightKg: 1.25,
                isLargeItem: false,
                packageWidthCm: null,
                packageHeightCm: null,
                packageLengthCm: null,
                parcelType: "cod",
                codAmount: 5000,
                deliveryFee: 800,
                deliveryFeePayer: "receiver",
                deliveryFeePaymentPlan: "receiver_collect_on_delivery",
                paymentNote: null,
            },
            merchantId: "00000000-0000-0000-0000-000000000001",
            riderId: null,
            pickupDetails: {
                id: null,
                label: "Temporary Pickup",
                townshipId: "00000000-0000-0000-0000-000000000002",
                pickupAddress: "No. 7, Example Road",
            },
            totalAmountToCollect: 5800,
            deliveryFeePaymentPlan: "receiver_collect_on_delivery",
            parcelStatus: "pending",
            pickupImageKeys: [],
            proofOfDeliveryImageKeys: [],
        });

        expect(parcelWriteValues.pickupLocationId).toBeNull();
        expect(parcelWriteValues.pickupLocationLabel).toBe("Temporary Pickup");
        expect(parcelWriteValues.pickupTownshipId).toBe("00000000-0000-0000-0000-000000000002");
        expect(parcelWriteValues.pickupAddress).toBe("No. 7, Example Road");
    });
});
