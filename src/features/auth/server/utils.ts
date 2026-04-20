import "server-only";
import { cache } from "react";
import { getAuthenticatedUser } from "./dal";
import { toAuthenticatedSession } from "./dto";
import { PERMISSION_SLUGS, type PermissionSlug } from "@/db/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const getAuthenticatedSession = cache(async () => {
    const supabase = await createSupabaseServerClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;

    if (claimsError || typeof userId !== "string") {
        return null;
    }

    return toAuthenticatedSession({
        supabaseUserId: userId,
    });
});

export const getCurrentAppAccessContext = cache(async () => {
    const session = await getAuthenticatedSession();

    if (!session) {
        return null;
    }

    return getAuthenticatedUser(session.supabaseUserId);
});

export async function requireAppAccessContext() {
    const currentUser = await getCurrentAppAccessContext();

    if (!currentUser) {
        throw new Error("Unauthorized");
    }

    if (!currentUser.isActive || currentUser.deletedAt) {
        throw new Error("Unauthorized");
    }

    return currentUser;
}

export function hasPermission(
    userPermissions: readonly PermissionSlug[],
    permission: PermissionSlug,
): boolean {
    return userPermissions.includes(permission);
}

export async function requirePermission(permission: PermissionSlug) {
    if (!PERMISSION_SLUGS.includes(permission)) {
        throw new Error(`Unknown permission: ${permission}`);
    }

    const currentUser = await requireAppAccessContext();

    if (currentUser.mustResetPassword && permission !== "dashboard-page.view") {
        throw new Error("Password reset required before this action is allowed");
    }

    if (!hasPermission(currentUser.permissions, permission)) {
        throw new Error("Forbidden");
    }

    return currentUser;
}
