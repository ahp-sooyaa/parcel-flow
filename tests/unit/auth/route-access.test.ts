import { describe, expect, it } from "vitest";
import { createAccessContext } from "../../setup/auth-fixtures";
import { canAccessDashboardPath } from "@/lib/auth/route-access";

describe("canAccessDashboardPath", () => {
  it("allows dashboard when user is active and has dashboard permission", () => {
    expect(
      canAccessDashboardPath(
        "/dashboard",
        createAccessContext({ permissions: ["dashboard-page.view"] }),
      ),
    ).toBe(true);
  });

  it("denies dashboard when dashboard permission is missing", () => {
    expect(canAccessDashboardPath("/dashboard", createAccessContext())).toBe(false);
  });

  it("denies all paths when user is inactive", () => {
    expect(
      canAccessDashboardPath(
        "/dashboard/users",
        createAccessContext({ isActive: false, permissions: ["user-list.view"] }),
      ),
    ).toBe(false);
  });

  it("allows only reset allowlist paths when mustResetPassword is true", () => {
    const context = createAccessContext({
      mustResetPassword: true,
      permissions: ["dashboard-page.view", "user-list.view"],
    });

    expect(canAccessDashboardPath("/dashboard", context)).toBe(true);
    expect(canAccessDashboardPath("/dashboard/profile", context)).toBe(true);
    expect(canAccessDashboardPath("/dashboard/users", context)).toBe(false);
  });

  it("uses exactAnyOf for /dashboard/merchants and anyOf for nested merchant routes", () => {
    const merchantViewer = createAccessContext({
      permissions: ["merchant.view"],
    });

    expect(canAccessDashboardPath("/dashboard/merchants", merchantViewer)).toBe(false);
    expect(canAccessDashboardPath("/dashboard/merchants/abc", merchantViewer)).toBe(true);
  });

  it("returns false for unknown dashboard paths", () => {
    expect(
      canAccessDashboardPath(
        "/dashboard/does-not-exist",
        createAccessContext({ permissions: ["dashboard-page.view"] }),
      ),
    ).toBe(false);
  });

  it("accepts any matching permission from a route rule", () => {
    expect(
      canAccessDashboardPath(
        "/dashboard/users",
        createAccessContext({ permissions: ["user-password.reset"] }),
      ),
    ).toBe(true);
  });

  it("allows exact merchants list path for merchant-list.view permission", () => {
    expect(
      canAccessDashboardPath(
        "/dashboard/merchants",
        createAccessContext({ permissions: ["merchant-list.view"] }),
      ),
    ).toBe(true);
  });

  it("denies nested merchant detail path for merchant-list.view without merchant.view", () => {
    expect(
      canAccessDashboardPath(
        "/dashboard/merchants/abc-123",
        createAccessContext({ permissions: ["merchant-list.view"] }),
      ),
    ).toBe(false);
  });

  it("denies removed merchant create route", () => {
    expect(
      canAccessDashboardPath(
        "/dashboard/merchants/create",
        createAccessContext({ permissions: ["user.create"] }),
      ),
    ).toBe(false);
  });

  it("allows nested user detail path with user.view permission", () => {
    expect(
      canAccessDashboardPath(
        "/dashboard/users/abc-123",
        createAccessContext({ permissions: ["user.view"] }),
      ),
    ).toBe(true);
  });

  it("allows profile path for any active user without separate permission", () => {
    expect(canAccessDashboardPath("/dashboard/profile", createAccessContext())).toBe(true);
  });

  it("requires township permissions for township routes", () => {
    expect(canAccessDashboardPath("/dashboard/townships", createAccessContext())).toBe(false);
    expect(
      canAccessDashboardPath(
        "/dashboard/townships",
        createAccessContext({ permissions: ["township-list.view"] }),
      ),
    ).toBe(true);
    expect(
      canAccessDashboardPath(
        "/dashboard/townships/create",
        createAccessContext({ permissions: ["township.update"] }),
      ),
    ).toBe(false);
    expect(
      canAccessDashboardPath(
        "/dashboard/townships/create",
        createAccessContext({ permissions: ["township.create"] }),
      ),
    ).toBe(true);
  });

  it("denies nested rider path when rider permission set is missing", () => {
    expect(
      canAccessDashboardPath(
        "/dashboard/riders/abc-123",
        createAccessContext({ permissions: ["dashboard-page.view"] }),
      ),
    ).toBe(false);
  });

  it("allows merchant self detail path without direct merchant permissions", () => {
    expect(
      canAccessDashboardPath(
        "/dashboard/merchants/merchant-1",
        createAccessContext({ appUserId: "merchant-1", roleSlug: "merchant" }),
      ),
    ).toBe(true);
  });

  it("allows rider self detail path without direct rider permissions", () => {
    expect(
      canAccessDashboardPath(
        "/dashboard/riders/rider-1",
        createAccessContext({ appUserId: "rider-1", roleSlug: "rider" }),
      ),
    ).toBe(true);
  });

  it("allows merchant self edit path without direct merchant permissions", () => {
    expect(
      canAccessDashboardPath(
        "/dashboard/merchants/merchant-1/edit",
        createAccessContext({ appUserId: "merchant-1", roleSlug: "merchant" }),
      ),
    ).toBe(true);
  });

  it("allows rider self edit path without direct rider permissions", () => {
    expect(
      canAccessDashboardPath(
        "/dashboard/riders/rider-1/edit",
        createAccessContext({ appUserId: "rider-1", roleSlug: "rider" }),
      ),
    ).toBe(true);
  });
});
