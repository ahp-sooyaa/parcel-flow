export const ROLE_SLUGS = ["super_admin", "office_admin", "rider", "merchant"] as const;

export type RoleSlug = (typeof ROLE_SLUGS)[number];

export const PERMISSION_SLUGS = [
  "dashboard-page.view",
  "user-password.reset",
  "user-list.view",
  "user.view",
  "user.create",
  "user.update",
  "user.delete",
  "merchant-list.view",
  "merchant.view",
  "merchant.create",
  "merchant.update",
  "merchant.delete",
  "rider-list.view",
  "rider.view",
  "rider.create",
  "rider.update",
  "rider.delete",
  "parcel-list.view",
  "parcel.view",
  "parcel.create",
  "parcel.update",
  "parcel.delete",
] as const;

export type PermissionSlug = (typeof PERMISSION_SLUGS)[number];

export const ESSENTIAL_PERMISSIONS = [
  "dashboard-page.view",
] as const satisfies readonly PermissionSlug[];

function withEssentialPermissions(permissions: PermissionSlug[]) {
  return Array.from(new Set([...permissions, ...ESSENTIAL_PERMISSIONS]));
}

export const ROLE_PERMISSION_MATRIX: Record<RoleSlug, PermissionSlug[]> = {
  super_admin: withEssentialPermissions([...PERMISSION_SLUGS]),
  office_admin: withEssentialPermissions([
    "merchant-list.view",
    "merchant.view",
    "merchant.create",
    "merchant.update",
    "rider-list.view",
    "rider.view",
    "rider.create",
    "rider.update",
    "parcel-list.view",
    "parcel.view",
    "parcel.create",
    "parcel.update",
  ]),
  rider: withEssentialPermissions(["parcel-list.view", "parcel.view", "parcel.update"]),
  merchant: withEssentialPermissions(["merchant.view"]),
};
