import { describe, expect, it } from "vitest";
import { createUserSchema, parseActiveFlag } from "@/features/users/server/utils";

describe("users server utils", () => {
  describe("parseActiveFlag", () => {
    it("returns true for checkbox and true string values", () => {
      expect(parseActiveFlag("on")).toBe(true);
      expect(parseActiveFlag("true")).toBe(true);
    });

    it("returns false for empty, null, and false-like values", () => {
      expect(parseActiveFlag("")).toBe(false);
      expect(parseActiveFlag("false")).toBe(false);
      expect(parseActiveFlag(null)).toBe(false);
      expect(parseActiveFlag("yes")).toBe(false);
    });
  });

  describe("createUserSchema", () => {
    it("accepts valid input and normalizes empty phone number to null", () => {
      const parsed = createUserSchema.safeParse({
        fullName: "Aung Htet",
        email: "admin@example.com",
        phoneNumber: "",
        role: "office_admin",
        isActive: true,
      });

      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.phoneNumber).toBeNull();
      }
    });

    it("rejects empty and null-ish invalid input values", () => {
      const parsed = createUserSchema.safeParse({
        fullName: "",
        email: "not-an-email",
        phoneNumber: null,
        role: "invalid-role",
        isActive: "true",
      });

      expect(parsed.success).toBe(false);
    });

    it("trims fullName and email fields for valid input", () => {
      const parsed = createUserSchema.safeParse({
        fullName: "  Aung Htet  ",
        email: "  admin@example.com  ",
        phoneNumber: " 09420000000 ",
        role: "office_admin",
        isActive: false,
      });

      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.fullName).toBe("Aung Htet");
        expect(parsed.data.email).toBe("admin@example.com");
        expect(parsed.data.phoneNumber).toBe("09420000000");
      }
    });
  });
});
