import { describe, expect, it } from "vitest";
import { createCurrentUserContext } from "../../setup/auth-fixtures";
import { toCurrentUserContext, toDashboardShellUserDto } from "@/features/auth/server/dto";

import type { CurrentUserContext } from "@/features/auth/server/dto";

describe("auth dto mappers", () => {
  it("toCurrentUserContext returns a defensive copy for permissions and nested role", () => {
    const input: CurrentUserContext = createCurrentUserContext({
      fullName: "Admin User",
      email: "admin@example.com",
      role: {
        id: "role-1",
        slug: "super_admin",
        label: "Super Admin",
      },
      permissions: ["dashboard-page.view", "user-list.view"],
    });

    const result = toCurrentUserContext(input);

    expect(result).toEqual(input);
    expect(result).not.toBe(input);
    expect(result.permissions).not.toBe(input.permissions);
    expect(result.role).not.toBe(input.role);
  });

  it("builds dashboard nav for office_admin permissions", () => {
    const dto = toDashboardShellUserDto({
      appUserId: "app-1",
      fullName: "Office Admin",
      mustResetPassword: false,
      permissions: [
        "dashboard-page.view",
        "user-list.view",
        "merchant-list.view",
        "parcel-list.view",
      ],
      role: { slug: "office_admin", label: "Office Admin" },
    });

    expect(dto.name).toBe("Office Admin");
    expect(dto.roleLabel).toBe("Office Admin");
    expect(dto.navItems.map((item) => item.key)).toEqual([
      "dashboard",
      "users",
      "merchants",
      "parcels",
    ]);
    expect(dto.mustResetPassword).toBe(false);
  });

  it("returns my-merchant navigation for merchant role when merchant.view exists", () => {
    const dto = toDashboardShellUserDto({
      appUserId: "merchant-user-1",
      fullName: "Merchant User",
      mustResetPassword: true,
      permissions: ["dashboard-page.view", "merchant.view"],
      role: { slug: "merchant", label: "Merchant" },
    });

    expect(dto.navItems).toEqual([
      { key: "dashboard", href: "/dashboard", label: "Dashboard" },
      {
        key: "my-merchant",
        href: "/dashboard/merchants/merchant-user-1",
        label: "My Merchant",
      },
    ]);
    expect(dto.mustResetPassword).toBe(true);
  });

  it("does not include unauthorized nav items when permissions are empty", () => {
    const dto = toDashboardShellUserDto({
      appUserId: "app-2",
      fullName: "No Access",
      mustResetPassword: false,
      permissions: [],
      role: { slug: "rider", label: "Rider" },
    });

    expect(dto.navItems).toEqual([]);
  });

  it("prefers merchant list nav for non-merchant role with merchant-list permission", () => {
    const dto = toDashboardShellUserDto({
      appUserId: "app-3",
      fullName: "Ops User",
      mustResetPassword: false,
      permissions: ["merchant-list.view"],
      role: { slug: "office_admin", label: "Office Admin" },
    });

    expect(dto.navItems).toEqual([
      { key: "merchants", href: "/dashboard/merchants", label: "Merchants" },
    ]);
  });

  it("does not create merchant nav for merchant role when merchant.view is missing", () => {
    const dto = toDashboardShellUserDto({
      appUserId: "merchant-user-2",
      fullName: "Merchant Limited",
      mustResetPassword: false,
      permissions: ["dashboard-page.view"],
      role: { slug: "merchant", label: "Merchant" },
    });

    expect(dto.navItems).toEqual([{ key: "dashboard", href: "/dashboard", label: "Dashboard" }]);
  });

  it("includes riders navigation when rider-list.view is present", () => {
    const dto = toDashboardShellUserDto({
      appUserId: "app-4",
      fullName: "Dispatch User",
      mustResetPassword: false,
      permissions: ["dashboard-page.view", "rider-list.view"],
      role: { slug: "office_admin", label: "Office Admin" },
    });

    expect(dto.navItems).toEqual([
      { key: "dashboard", href: "/dashboard", label: "Dashboard" },
      { key: "riders", href: "/dashboard/riders", label: "Riders" },
    ]);
  });
});
