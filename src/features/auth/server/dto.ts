import "server-only";
import type { PermissionSlug, RoleSlug } from "@/db/constants";

export type CurrentUserContext = {
  appUserId: string;
  supabaseUserId: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  role: {
    id: string;
    slug: RoleSlug;
    label: string;
  };
  isActive: boolean;
  mustResetPassword: boolean;
  permissions: PermissionSlug[];
};

export type DashboardShellUserDto = {
  name: string;
  roleLabel: string;
  navItems: {
    key: "dashboard" | "users" | "merchants" | "my-merchant" | "riders" | "parcels";
    href: string;
    label: string;
  }[];
  mustResetPassword: boolean;
};

export type AuthActionResult = {
  ok: boolean;
  message: string;
};

export function toCurrentUserContext(input: CurrentUserContext): CurrentUserContext {
  return {
    appUserId: input.appUserId,
    supabaseUserId: input.supabaseUserId,
    fullName: input.fullName,
    email: input.email,
    phoneNumber: input.phoneNumber,
    isActive: input.isActive,
    mustResetPassword: input.mustResetPassword,
    role: {
      id: input.role.id,
      slug: input.role.slug,
      label: input.role.label,
    },
    permissions: [...input.permissions],
  };
}

export function toDashboardShellUserDto(input: {
  appUserId: string;
  fullName: string;
  mustResetPassword: boolean;
  permissions: readonly PermissionSlug[];
  role: { slug: RoleSlug; label: string };
}): DashboardShellUserDto {
  const navItems: DashboardShellUserDto["navItems"] = [];

  if (input.permissions.includes("dashboard-page.view")) {
    navItems.push({ key: "dashboard", href: "/dashboard", label: "Dashboard" });
  }

  if (input.permissions.includes("user-list.view")) {
    navItems.push({ key: "users", href: "/dashboard/users", label: "Users" });
  }

  if (input.role.slug === "merchant" && input.permissions.includes("merchant.view")) {
    navItems.push({
      key: "my-merchant",
      href: `/dashboard/merchants/${input.appUserId}`,
      label: "My Merchant",
    });
  } else if (input.permissions.includes("merchant-list.view")) {
    navItems.push({ key: "merchants", href: "/dashboard/merchants", label: "Merchants" });
  }

  if (input.permissions.includes("rider-list.view")) {
    navItems.push({ key: "riders", href: "/dashboard/riders", label: "Riders" });
  }

  if (input.permissions.includes("parcel-list.view")) {
    navItems.push({ key: "parcels", href: "/dashboard/parcels", label: "Parcels" });
  }

  return {
    name: input.fullName,
    roleLabel: input.role.label,
    navItems,
    mustResetPassword: input.mustResetPassword,
  };
}
