import "server-only";
import { z } from "zod";
import { ROLE_SLUGS } from "@/db/constants";
import { findRoleBySlug } from "@/features/auth/server/dal";
import { findTownshipById } from "@/features/townships/server/dal";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { optionalNullableTrimmedString, optionalNullableUuid } from "@/lib/validation/zod-helpers";

import type { RoleSlug } from "@/db/constants";
const checkboxBoolean = z.preprocess((value) => value === "on" || value === "true", z.boolean());

export function normalizeUserSearchQuery(raw: string | undefined) {
    return raw?.trim() ?? "";
}

export function toUserSearchPattern(query: string) {
    return `%${query.replaceAll("%", "").replaceAll("_", "")}%`;
}

export const createUserSchema = z.object({
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().email(),
    phoneNumber: optionalNullableTrimmedString(30),
    role: z.enum(ROLE_SLUGS),
    isActive: checkboxBoolean,
    merchantShopName: optionalNullableTrimmedString(120),
    merchantNotes: optionalNullableTrimmedString(1000),
    primaryPickupLabel: optionalNullableTrimmedString(120),
    primaryPickupTownshipId: optionalNullableUuid(),
    primaryPickupAddress: optionalNullableTrimmedString(255),
    primaryPickupContactName: optionalNullableTrimmedString(120),
    primaryPickupContactPhone: optionalNullableTrimmedString(30),
    riderTownshipId: optionalNullableUuid(),
    riderVehicleType: optionalNullableTrimmedString(50),
    riderLicensePlate: optionalNullableTrimmedString(50),
    riderNotes: optionalNullableTrimmedString(1000),
    riderIsActive: checkboxBoolean,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateAccountProfileSchema = z.object({
    targetUserId: optionalNullableUuid(),
    fullName: z.string().trim().min(2).max(120),
    phoneNumber: optionalNullableTrimmedString(30),
});

export const changePasswordSchema = z
    .object({
        password: z.string().min(12),
        confirmPassword: z.string().min(12),
    })
    .refine((value) => value.password === value.confirmPassword, {
        message: "Passwords do not match.",
        path: ["confirmPassword"],
    });

export const softDeleteUserSchema = z.object({
    userId: z.string().trim().uuid(),
});

export function parseActiveFlag(raw: FormDataEntryValue | null) {
    return raw === "on" || raw === "true";
}

export async function validateCreateUserInput(
    input: CreateUserInput,
    currentUserRoleSlug: RoleSlug,
) {
    const role = await findRoleBySlug(input.role);

    if (!role) {
        return { ok: false as const, message: "Selected role was not found." };
    }

    if (input.role === "super_admin" && currentUserRoleSlug !== "super_admin") {
        return {
            ok: false as const,
            message: "Only super admin can create super admin users.",
        };
    }

    if (input.role === "merchant") {
        if (!input.primaryPickupLabel) {
            return {
                ok: false as const,
                message: "Primary pickup location label is required for merchant users.",
                fieldErrors: {
                    primaryPickupLabel: [
                        "Primary pickup location label is required for merchant users.",
                    ],
                },
            };
        }

        if (!input.primaryPickupTownshipId) {
            return {
                ok: false as const,
                message: "Primary pickup township is required for merchant users.",
                fieldErrors: {
                    primaryPickupTownshipId: [
                        "Primary pickup township is required for merchant users.",
                    ],
                },
            };
        }

        if (!input.primaryPickupAddress) {
            return {
                ok: false as const,
                message: "Primary pickup address is required for merchant users.",
                fieldErrors: {
                    primaryPickupAddress: [
                        "Primary pickup address is required for merchant users.",
                    ],
                },
            };
        }

        if (!input.primaryPickupContactName) {
            return {
                ok: false as const,
                message: "Primary pickup contact name is required for merchant users.",
                fieldErrors: {
                    primaryPickupContactName: [
                        "Primary pickup contact name is required for merchant users.",
                    ],
                },
            };
        }

        if (!input.primaryPickupContactPhone) {
            return {
                ok: false as const,
                message: "Primary pickup contact phone is required for merchant users.",
                fieldErrors: {
                    primaryPickupContactPhone: [
                        "Primary pickup contact phone is required for merchant users.",
                    ],
                },
            };
        }
    }

    const townshipChecks = [
        {
            townshipId: input.primaryPickupTownshipId,
            message: "Selected primary pickup township was not found.",
        },
        {
            townshipId: input.riderTownshipId,
            message: "Selected rider township was not found.",
        },
    ];

    for (const check of townshipChecks) {
        if (!check.townshipId) {
            continue;
        }

        const township = await findTownshipById(check.townshipId);

        if (!township?.isActive) {
            return {
                ok: false as const,
                message: check.message,
                fieldErrors:
                    check.townshipId === input.primaryPickupTownshipId
                        ? {
                              primaryPickupTownshipId: [check.message],
                          }
                        : {
                              riderTownshipId: [check.message],
                          },
            };
        }
    }

    return { ok: true as const, role };
}

export function mapPasswordUpdateError(error: {
    message?: string;
    code?: string;
    status?: number;
}) {
    const message = error.message?.toLowerCase() ?? "";
    const code = error.code?.toLowerCase() ?? "";

    if (message.includes("same") || message.includes("different from the old password")) {
        return "Please choose a new password that is different from your current password.";
    }

    if (
        message.includes("weak") ||
        message.includes("strength") ||
        message.includes("security purposes")
    ) {
        return "Your new password is too weak. Use a stronger password with at least 12 characters.";
    }

    if (code === "reauthentication_needed" || message.includes("reauthentication")) {
        return "For security, please sign in again and then change your password.";
    }

    if (code === "over_request_rate_limit" || message.includes("rate limit")) {
        return "Too many attempts. Please wait a moment and try again.";
    }

    if (error.status === 401 || message.includes("jwt") || message.includes("token")) {
        return "Your session has expired. Please sign in again and try changing your password.";
    }

    return "Could not update password. Please try again.";
}

export async function provisionAuthUser(
    input: Pick<CreateUserInput, "email" | "fullName">,
    temporaryPassword: string,
) {
    const supabaseAdmin = createSupabaseAdminClient();
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: input.email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
            full_name: input.fullName,
        },
    });

    if (error || !data.user) {
        return { ok: false as const, message: "Could not provision Supabase user." };
    }

    return { ok: true as const, supabaseAdmin, supabaseUserId: data.user.id };
}

export async function resetAuthUserPassword(supabaseUserId: string, temporaryPassword: string) {
    const supabaseAdmin = createSupabaseAdminClient();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(supabaseUserId, {
        password: temporaryPassword,
    });

    if (error) {
        return { ok: false as const, message: "Failed to update auth password." };
    }

    return { ok: true as const };
}

export async function deleteAuthUser(supabaseUserId: string) {
    const supabaseAdmin = createSupabaseAdminClient();
    const { error } = await supabaseAdmin.auth.admin.deleteUser(supabaseUserId);

    return {
        ok: !error,
        error,
    };
}

export async function updateOwnAuthPassword(password: string) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
        return { ok: false as const, message: mapPasswordUpdateError(error) };
    }

    return { ok: true as const };
}
