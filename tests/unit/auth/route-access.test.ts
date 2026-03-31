import { describe, expect, it } from "vitest";
import { canAccessDashboardPath } from "@/lib/auth/route-access";

describe("canAccessDashboardPath", () => {
  it("allows dashboard when user is active and has dashboard permission", () => {
    expect(
      canAccessDashboardPath("/dashboard", {
        isActive: true,
        mustResetPassword: false,
        permissions: ["dashboard-page.view"],
      }),
    ).toBe(true);
  });

  it("denies dashboard when dashboard permission is missing", () => {
    expect(
      canAccessDashboardPath("/dashboard", {
        isActive: true,
        mustResetPassword: false,
        permissions: [],
      }),
    ).toBe(false);
  });

  it("denies all paths when user is inactive", () => {
    expect(
      canAccessDashboardPath("/dashboard/users", {
        isActive: false,
        mustResetPassword: false,
        permissions: ["user-list.view"],
      }),
    ).toBe(false);
  });

  it("allows only reset allowlist paths when mustResetPassword is true", () => {
    const context = {
      isActive: true,
      mustResetPassword: true,
      permissions: ["dashboard-page.view", "user-list.view"],
    };

    expect(canAccessDashboardPath("/dashboard", context)).toBe(true);
    expect(canAccessDashboardPath("/dashboard/profile", context)).toBe(true);
    expect(canAccessDashboardPath("/dashboard/users", context)).toBe(false);
  });

  it("uses exactAnyOf for /dashboard/merchants and anyOf for nested merchant routes", () => {
    const merchantViewer = {
      isActive: true,
      mustResetPassword: false,
      permissions: ["merchant.view"],
    };

    expect(canAccessDashboardPath("/dashboard/merchants", merchantViewer)).toBe(false);
    expect(canAccessDashboardPath("/dashboard/merchants/abc", merchantViewer)).toBe(true);
  });

  it("returns false for unknown dashboard paths", () => {
    expect(
      canAccessDashboardPath("/dashboard/does-not-exist", {
        isActive: true,
        mustResetPassword: false,
        permissions: ["dashboard-page.view"],
      }),
    ).toBe(false);
  });

  it("accepts any matching permission from a route rule", () => {
    expect(
      canAccessDashboardPath("/dashboard/users", {
        isActive: true,
        mustResetPassword: false,
        permissions: ["user-password.reset"],
      }),
    ).toBe(true);
  });

  it("allows exact merchants list path for merchant-list.view permission", () => {
    expect(
      canAccessDashboardPath("/dashboard/merchants", {
        isActive: true,
        mustResetPassword: false,
        permissions: ["merchant-list.view"],
      }),
    ).toBe(true);
  });

  it("denies nested merchant detail path for merchant-list.view without merchant.view", () => {
    expect(
      canAccessDashboardPath("/dashboard/merchants/abc-123", {
        isActive: true,
        mustResetPassword: false,
        permissions: ["merchant-list.view"],
      }),
    ).toBe(false);
  });

  it("allows nested user detail path with user.view permission", () => {
    expect(
      canAccessDashboardPath("/dashboard/users/abc-123", {
        isActive: true,
        mustResetPassword: false,
        permissions: ["user.view"],
      }),
    ).toBe(true);
  });

  it("allows profile path for any active user without separate permission", () => {
    expect(
      canAccessDashboardPath("/dashboard/profile", {
        isActive: true,
        mustResetPassword: false,
        permissions: [],
      }),
    ).toBe(true);
  });

  it("denies nested rider path when rider permission set is missing", () => {
    expect(
      canAccessDashboardPath("/dashboard/riders/abc-123", {
        isActive: true,
        mustResetPassword: false,
        permissions: ["dashboard-page.view"],
      }),
    ).toBe(false);
  });
});
