import "server-only";
import type { PermissionSlug, RoleSlug } from "@/db/constants";

export type AuthenticatedSession = {
    supabaseUserId: string;
};

export type AppAccessContext = {
    appUserId: string;
    supabaseUserId: string;
    fullName: string;
    email: string;
    phoneNumber: string | null;
    roleSlug: RoleSlug;
    isActive: boolean;
    deletedAt: Date | null;
    mustResetPassword: boolean;
    permissions: PermissionSlug[];
};

export type AppAccessViewer = Pick<AppAccessContext, "appUserId" | "roleSlug" | "permissions">;

export type DashboardShellUserDto = {
    name: string;
    roleSlug: RoleSlug;
    navItems: {
        key:
            | "dashboard"
            | "users"
            | "merchants"
            | "riders"
            | "parcels"
            | "settlements"
            | "townships"
            | "delivery-pricing"
            | "address-book";
        href: string;
        label: string;
    }[];
    mustResetPassword: boolean;
};

export type AuthActionResult = {
    ok: boolean;
    message: string;
};

export function toAuthenticatedSession(input: AuthenticatedSession): AuthenticatedSession {
    return {
        supabaseUserId: input.supabaseUserId,
    };
}

export function toAppAccessContext(input: AppAccessContext): AppAccessContext {
    return {
        appUserId: input.appUserId,
        supabaseUserId: input.supabaseUserId,
        fullName: input.fullName,
        email: input.email,
        phoneNumber: input.phoneNumber,
        roleSlug: input.roleSlug,
        isActive: input.isActive,
        deletedAt: input.deletedAt,
        mustResetPassword: input.mustResetPassword,
        permissions: [...input.permissions],
    };
}

export function toDashboardShellUserDto(input: {
    appUserId: string;
    fullName: string;
    mustResetPassword: boolean;
    permissions: readonly PermissionSlug[];
    roleSlug: RoleSlug;
}): DashboardShellUserDto {
    const navItems: DashboardShellUserDto["navItems"] = [];

    if (input.permissions.includes("dashboard-page.view")) {
        navItems.push({ key: "dashboard", href: "/dashboard", label: "Dashboard" });
    }

    if (input.permissions.includes("user-list.view")) {
        navItems.push({ key: "users", href: "/dashboard/users", label: "Users" });
    }

    if (input.roleSlug === "merchant") {
        navItems.push({
            key: "parcels",
            href: `/dashboard/merchants/${input.appUserId}`,
            label: "My Parcels",
        });
    } else if (input.permissions.includes("merchant-list.view")) {
        navItems.push({ key: "merchants", href: "/dashboard/merchants", label: "Merchants" });
    }

    if (input.roleSlug === "rider") {
        navItems.push({
            key: "parcels",
            href: `/dashboard/riders/${input.appUserId}`,
            label: "My Parcels",
        });
    } else if (input.permissions.includes("rider-list.view")) {
        navItems.push({ key: "riders", href: "/dashboard/riders", label: "Riders" });
    }

    if (input.permissions.includes("parcel-list.view")) {
        navItems.push({ key: "parcels", href: "/dashboard/parcels", label: "Parcels" });
    }

    if (input.permissions.includes("merchant-settlement.view")) {
        navItems.push({
            key: "settlements",
            href: "/dashboard/settlements",
            label: "Settlements",
        });
    }

    if (input.permissions.includes("township-list.view")) {
        navItems.push({ key: "townships", href: "/dashboard/townships", label: "Townships" });
    }

    if (input.permissions.includes("delivery-pricing.view")) {
        navItems.push({
            key: "delivery-pricing",
            href: "/dashboard/delivery-pricing",
            label: "Delivery Pricing",
        });
    }

    if (input.permissions.includes("address-book.view")) {
        navItems.push({
            key: "address-book",
            href: "/dashboard/address-book",
            label: "Address Book",
        });
    }

    return {
        name: input.fullName,
        roleSlug: input.roleSlug,
        navItems,
        mustResetPassword: input.mustResetPassword,
    };
}
