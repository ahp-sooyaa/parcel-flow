import type { PermissionSlug } from "@/db/constants";

export type AccessContext = {
  permissions: readonly string[];
  isActive: boolean;
  mustResetPassword: boolean;
};

const resetRequiredAllowlist = new Set(["/dashboard", "/dashboard/profile"]);

type RoutePermissionRule = {
  pathnamePrefix: string;
  anyOf: readonly PermissionSlug[];
  /** If provided, used instead of `anyOf` when the path matches exactly. */
  exactAnyOf?: readonly PermissionSlug[];
};

const routePermissionRules: readonly RoutePermissionRule[] = [
  {
    pathnamePrefix: "/dashboard/users",
    anyOf: [
      "user-list.view",
      "user.view",
      "user.create",
      "user.update",
      "user.delete",
      "user-password.reset",
    ],
  },
  {
    pathnamePrefix: "/dashboard/riders",
    anyOf: ["rider-list.view", "rider.view", "rider.create", "rider.update", "rider.delete"],
  },
  {
    pathnamePrefix: "/dashboard/parcels",
    anyOf: ["parcel-list.view", "parcel.view", "parcel.create", "parcel.update", "parcel.delete"],
  },
  {
    pathnamePrefix: "/dashboard/merchants/create",
    anyOf: ["merchant.create"],
  },
  {
    pathnamePrefix: "/dashboard/merchants",
    exactAnyOf: ["merchant-list.view"],
    anyOf: ["merchant.view"],
  },
];

export function canAccessDashboardPath(pathname: string, context: AccessContext) {
  if (!context.isActive) {
    return false;
  }

  if (context.mustResetPassword) {
    return resetRequiredAllowlist.has(pathname);
  }

  if (pathname === "/dashboard") {
    return context.permissions.includes("dashboard-page.view");
  }

  if (pathname === "/dashboard/profile" || pathname.startsWith("/dashboard/profile/")) {
    return true;
  }

  const permissionSet = new Set(context.permissions);

  for (const rule of routePermissionRules) {
    if (pathname === rule.pathnamePrefix) {
      const permissions = rule.exactAnyOf ?? rule.anyOf;
      return permissions.some((p) => permissionSet.has(p));
    }

    if (pathname.startsWith(rule.pathnamePrefix + "/")) {
      return rule.anyOf.some((p) => permissionSet.has(p));
    }
  }

  return false;
}
