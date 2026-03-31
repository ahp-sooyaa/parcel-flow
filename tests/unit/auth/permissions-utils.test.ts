import { describe, expect, it } from "vitest";
import { hasPermission } from "@/features/auth/server/utils";

describe("hasPermission", () => {
  it("returns true when target permission exists", () => {
    expect(hasPermission(["dashboard-page.view", "user-list.view"], "user-list.view")).toBe(true);
  });

  it("returns false when target permission does not exist", () => {
    expect(hasPermission(["dashboard-page.view"], "user-list.view")).toBe(false);
  });

  it("returns false for empty permissions input", () => {
    expect(hasPermission([], "dashboard-page.view")).toBe(false);
  });

  it("does not coerce unknown strings into valid permissions", () => {
    expect(hasPermission(["not-a-real-permission"], "dashboard-page.view")).toBe(false);
  });

  it("still returns true when permission appears multiple times", () => {
    expect(hasPermission(["user-list.view", "user-list.view"], "user-list.view")).toBe(true);
  });
});
