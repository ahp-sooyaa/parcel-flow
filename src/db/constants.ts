export const ROLE_SLUGS = ["super_admin", "office_admin", "rider", "merchant"] as const;

export type RoleSlug = (typeof ROLE_SLUGS)[number];

export function isRoleSlug(value: string): value is RoleSlug {
    return ROLE_SLUGS.includes(value as RoleSlug);
}

export const PERMISSION_SLUGS = [
    "dashboard-page.view",
    "user-password.reset",
    "user-list.view",
    "user.view",
    "user.create",
    "user.update",
    "user.delete",
    "township-list.view",
    "township.create",
    "township.update",
    "township.delete",
    "merchant-list.view",
    "merchant.view",
    "merchant.update",
    "merchant.delete",
    "rider-list.view",
    "rider.view",
    "rider.update",
    "rider.delete",
    "bank-account.view",
    "bank-account.create",
    "bank-account.update",
    "bank-account.delete",
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
        "user-list.view",
        "user.view",
        "user.create",
        "user.update",
        "township-list.view",
        "township.update",
        "merchant-list.view",
        "merchant.view",
        "merchant.update",
        "rider-list.view",
        "rider.view",
        "rider.update",
        "bank-account.view",
        "parcel-list.view",
        "parcel.view",
        "parcel.create",
        "parcel.update",
    ]),
    rider: withEssentialPermissions([]),
    merchant: withEssentialPermissions(["parcel.create"]),
};
