import { describe, expect, it } from "vitest";
import {
  normalizeMerchantSearchQuery,
  toMerchantSearchPattern,
} from "@/features/merchant/server/utils";

describe("merchant server utils", () => {
  it("normalizes merchant search query", () => {
    expect(normalizeMerchantSearchQuery(undefined)).toBe("");
    expect(normalizeMerchantSearchQuery("  Aung Shop  ")).toBe("Aung Shop");
  });

  it("builds safe ILIKE pattern from query", () => {
    expect(toMerchantSearchPattern("abc")).toBe("%abc%");
    expect(toMerchantSearchPattern("%a_b%")).toBe("%ab%");
  });
});
