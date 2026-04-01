import { describe, expect, it } from "vitest";
import { YANGON_TOWNSHIPS } from "@/features/merchant/constants";
import {
  createMerchantSchema,
  normalizeMerchantSearchQuery,
  toMerchantSearchPattern,
} from "@/features/merchant/server/utils";

describe("merchant server utils", () => {
  describe("createMerchantSchema", () => {
    it("accepts valid input and normalizes optional fields to null", () => {
      const parsed = createMerchantSchema.safeParse({
        name: "  Golden Shop  ",
        phoneNumber: "",
        address: "  No 12, Main Street  ",
        township: YANGON_TOWNSHIPS[0],
        notes: "",
        linkedAppUserId: "",
      });

      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.name).toBe("Golden Shop");
        expect(parsed.data.address).toBe("No 12, Main Street");
        expect(parsed.data.phoneNumber).toBeNull();
        expect(parsed.data.notes).toBeNull();
        expect(parsed.data.linkedAppUserId).toBeNull();
      }
    });

    it("rejects invalid required values", () => {
      const parsed = createMerchantSchema.safeParse({
        name: "",
        phoneNumber: "09abcdef",
        address: "",
        township: "Invalid Township",
        linkedAppUserId: "not-a-uuid",
      });

      expect(parsed.success).toBe(false);
    });
  });

  it("normalizes merchant search query", () => {
    expect(normalizeMerchantSearchQuery(undefined)).toBe("");
    expect(normalizeMerchantSearchQuery("  Aung Shop  ")).toBe("Aung Shop");
  });

  it("builds safe ILIKE pattern from query", () => {
    expect(toMerchantSearchPattern("abc")).toBe("%abc%");
    expect(toMerchantSearchPattern("%a_b%")).toBe("%ab%");
  });
});
