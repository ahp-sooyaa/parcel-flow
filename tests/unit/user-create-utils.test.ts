import { describe, expect, it } from "vitest";
import { createUserSchema } from "../../src/features/users/server/utils";

describe("create user schema", () => {
    it("parses merchant primary pickup fields", () => {
        const parsed = createUserSchema.safeParse({
            fullName: "Merchant User",
            email: "merchant@example.com",
            phoneNumber: "0912345678",
            role: "merchant",
            isActive: "true",
            merchantShopName: "Main Shop",
            merchantNotes: "",
            primaryPickupLabel: "Main Pickup",
            primaryPickupTownshipId: "00000000-0000-0000-0000-000000000010",
            primaryPickupAddress: "No. 5, Merchant Street",
            riderTownshipId: "",
            riderVehicleType: "",
            riderLicensePlate: "",
            riderNotes: "",
            riderIsActive: "true",
        });

        expect(parsed.success).toBe(true);
        expect(parsed.data?.primaryPickupLabel).toBe("Main Pickup");
        expect(parsed.data?.primaryPickupTownshipId).toBe("00000000-0000-0000-0000-000000000010");
        expect(parsed.data?.primaryPickupAddress).toBe("No. 5, Merchant Street");
    });

    it("keeps merchant pickup fields nullable for non-merchant roles", () => {
        const parsed = createUserSchema.safeParse({
            fullName: "Office Admin",
            email: "office@example.com",
            phoneNumber: "",
            role: "office_admin",
            isActive: "true",
            merchantShopName: "",
            merchantNotes: "",
            primaryPickupLabel: "",
            primaryPickupTownshipId: "",
            primaryPickupAddress: "",
            riderTownshipId: "",
            riderVehicleType: "",
            riderLicensePlate: "",
            riderNotes: "",
            riderIsActive: "true",
        });

        expect(parsed.success).toBe(true);
        expect(parsed.data?.primaryPickupLabel).toBeNull();
        expect(parsed.data?.primaryPickupTownshipId).toBeNull();
        expect(parsed.data?.primaryPickupAddress).toBeNull();
    });
});
