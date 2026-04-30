import { describe, expect, it } from "vitest";
import {
    merchantContactReferenceSchema,
    normalizeMerchantContactLabel,
} from "../../src/features/merchant-contacts/server/utils";
import {
    parseCreateParcelFormData,
    updateParcelDetailSchema,
} from "../../src/features/parcels/server/utils";

describe("merchant contact helpers", () => {
    it("normalizes labels by trimming and lowercasing", () => {
        expect(normalizeMerchantContactLabel("  Ko Aung Home  ")).toBe("ko aung home");
    });

    it("defaults contact reference fields when omitted", () => {
        const parsed = merchantContactReferenceSchema.safeParse({});

        expect(parsed.success).toBe(true);
        expect(parsed.data).toEqual({
            selectedMerchantContactId: null,
            contactLabel: null,
            saveRecipientContact: false,
        });
    });

    it("parses create parcel contact reference fields from form data", () => {
        const formData = new FormData();

        formData.set("merchantId", "00000000-0000-0000-0000-000000000010");
        formData.set("riderId", "");
        formData.set("pickupLocationId", "00000000-0000-0000-0000-000000000040");
        formData.set("pickupLocationLabel", "Main Shop");
        formData.set("pickupTownshipId", "00000000-0000-0000-0000-000000000041");
        formData.set("pickupAddress", "No. 3, Merchant Lane");
        formData.set("savePickupLocation", "false");
        formData.set("selectedMerchantContactId", "00000000-0000-0000-0000-000000000020");
        formData.set("contactLabel", "Office");
        formData.set("saveRecipientContact", "on");
        formData.set("recipientName", "Ko Aung");
        formData.set("recipientPhone", "0912345678");
        formData.set("recipientTownshipId", "00000000-0000-0000-0000-000000000030");
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

        expect(parsed.data.selectedMerchantContactId).toBe("00000000-0000-0000-0000-000000000020");
        expect(parsed.data.contactLabel).toBe("Office");
        expect(parsed.data.saveRecipientContact).toBe(true);
    });

    it("parses edit parcel contact reference fields", () => {
        const parsed = updateParcelDetailSchema.safeParse({
            parcelId: "00000000-0000-0000-0000-000000000001",
            merchantId: "00000000-0000-0000-0000-000000000010",
            riderId: "",
            pickupLocationId: "00000000-0000-0000-0000-000000000040",
            selectedMerchantContactId: "",
            contactLabel: "Warehouse",
            saveRecipientContact: "true",
            recipientName: "Ma Su",
            recipientPhone: "0998765432",
            recipientTownshipId: "00000000-0000-0000-0000-000000000030",
            recipientAddress: "No. 2, Example Street",
            parcelDescription: "Shoes",
            packageCount: "1",
            specialHandlingNote: "",
            estimatedWeightKg: "1.25",
            isLargeItem: "false",
            packageWidthCm: "",
            packageHeightCm: "",
            packageLengthCm: "",
            parcelType: "cod",
            codAmount: "5000",
            deliveryFee: "800",
            deliveryFeePayer: "receiver",
            deliveryFeePaymentPlan: "receiver_collect_on_delivery",
        });

        expect(parsed.success).toBe(true);
        expect(parsed.data?.contactLabel).toBe("Warehouse");
        expect(parsed.data?.saveRecipientContact).toBe(true);
        expect(parsed.data?.selectedMerchantContactId).toBeNull();
    });
});
