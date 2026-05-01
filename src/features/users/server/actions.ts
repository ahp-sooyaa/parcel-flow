"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
    countActiveSuperAdminUsers,
    createAppUserWithProfiles,
    getUserWithRoleById,
    softDeleteUserWithProfiles,
    updateUserAccountProfile,
    updateUserActiveStatus,
    updateUserMustResetPassword,
} from "./dal";
import {
    changePasswordSchema,
    createUserSchema,
    deleteAuthUser,
    parseActiveFlag,
    provisionAuthUser,
    updateOwnAuthPassword,
    resetAuthUserPassword,
    softDeleteUserSchema,
    updateAccountProfileSchema,
    validateCreateUserInput,
} from "./utils";
import { getSelfAccountAccess } from "@/features/auth/server/policies/self-account";
import { getUserManagementAccess } from "@/features/auth/server/policies/user-management";
import { requireAppAccessContext, requirePermission } from "@/features/auth/server/utils";
import { logAuditEvent } from "@/lib/security/audit";
import { generateStrongPassword } from "@/lib/security/password";

import type {
    AccountActionResult,
    CreateUserActionResult,
    ResetUserPasswordActionResult,
    SoftDeleteUserActionResult,
} from "./dto";

export async function createUserAction(
    _prevState: CreateUserActionResult,
    formData: FormData,
): Promise<CreateUserActionResult> {
    try {
        const currentUser = await requirePermission("user.create");
        const parsed = createUserSchema.safeParse(Object.fromEntries(formData));

        if (!parsed.success) {
            return {
                ok: false,
                message: "Please provide valid user details.",
                fieldErrors: parsed.error.flatten().fieldErrors,
            };
        }

        const guards = await validateCreateUserInput(parsed.data, currentUser.roleSlug);

        if (!guards.ok) {
            return {
                ok: false,
                message: guards.message,
                fieldErrors: "fieldErrors" in guards ? guards.fieldErrors : undefined,
            };
        }

        const tempPassword = generateStrongPassword(20);
        const authUser = await provisionAuthUser(parsed.data, tempPassword);

        if (!authUser.ok) {
            return { ok: false, message: authUser.message };
        }

        const appUser = await createAppUserWithProfiles({
            input: parsed.data,
            roleId: guards.role.id,
            supabaseUserId: authUser.supabaseUserId,
        });

        if (!appUser.ok) {
            await deleteAuthUser(authUser.supabaseUserId);

            return { ok: false, message: appUser.message };
        }

        revalidatePath("/dashboard/users");
        revalidatePath("/dashboard/merchants");
        revalidatePath("/dashboard/riders");

        await logAuditEvent({
            event: "user.create",
            actorAppUserId: currentUser.appUserId,
            metadata: {
                role: parsed.data.role,
                isActive: parsed.data.isActive,
                riderTownshipId: parsed.data.riderTownshipId,
                riderIsActive: parsed.data.riderIsActive,
            },
        });

        return {
            ok: true,
            message: "User created. Temporary password is shown once below.",
            temporaryPassword: tempPassword,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to create user.";

        return { ok: false, message };
    }
}

export async function resetUserPasswordAction(
    _prevState: ResetUserPasswordActionResult,
    formData: FormData,
): Promise<ResetUserPasswordActionResult> {
    try {
        const currentUser = await requirePermission("user-password.reset");

        const userId = String(formData.get("userId") || "");

        if (!userId) {
            return { ok: false, message: "User id is required." };
        }

        const targetUser = await getUserWithRoleById(userId);

        if (!targetUser) {
            return { ok: false, message: "User was not found." };
        }

        const temporaryPassword = generateStrongPassword(20);
        const passwordReset = await resetAuthUserPassword(
            targetUser.supabaseUserId,
            temporaryPassword,
        );

        if (!passwordReset.ok) {
            return { ok: false, message: passwordReset.message };
        }

        await updateUserMustResetPassword(targetUser.id, true);

        revalidatePath(`/dashboard/users/${targetUser.id}`);
        revalidatePath("/dashboard/users");

        await logAuditEvent({
            event: "users.reset_password",
            actorAppUserId: currentUser.appUserId,
            targetAppUserId: targetUser.id,
        });

        return {
            ok: true,
            message: "Password reset. Temporary password is shown once below.",
            temporaryPassword,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to reset password.";

        return { ok: false, message };
    }
}

export async function updateUserStatusAction(formData: FormData) {
    const currentUser = await requirePermission("user.update");

    const userId = String(formData.get("userId") || "");
    const isActive = parseActiveFlag(formData.get("isActive"));

    if (!userId) {
        throw new Error("User id is required");
    }

    const targetUser = await getUserWithRoleById(userId);

    if (!targetUser) {
        throw new Error("User was not found");
    }

    if (!isActive && currentUser.appUserId === targetUser.id) {
        throw new Error("You cannot disable your own account.");
    }

    if (!isActive && targetUser.isActive && targetUser.roleSlug === "super_admin") {
        const activeSuperAdminCount = await countActiveSuperAdminUsers();

        if (activeSuperAdminCount <= 1) {
            throw new Error("Cannot disable the last active super admin account.");
        }
    }

    await updateUserActiveStatus(userId, isActive);

    await logAuditEvent({
        event: "user.update",
        actorAppUserId: currentUser.appUserId,
        targetAppUserId: userId,
        metadata: {
            isActive,
        },
    });

    revalidatePath(`/dashboard/users/${userId}`);
    revalidatePath("/dashboard/users");
}

export async function updateAccountProfileAction(
    _prevState: AccountActionResult,
    formData: FormData,
): Promise<AccountActionResult> {
    try {
        const currentUser = await requireAppAccessContext();

        const parsed = updateAccountProfileSchema.safeParse(Object.fromEntries(formData));

        if (!parsed.success) {
            return { ok: false, message: "Please provide valid account details." };
        }

        const targetUserId = parsed.data.targetUserId ?? currentUser.appUserId;
        const targetUser = await getUserWithRoleById(targetUserId);

        if (!targetUser) {
            return { ok: false, message: "User was not found." };
        }

        const userManagementAccess = getUserManagementAccess(currentUser);
        const selfAccountAccess = getSelfAccountAccess({
            viewer: currentUser,
            targetUserId: targetUser.id,
        });

        if (!userManagementAccess.canUpdateTarget && !selfAccountAccess.canUpdateSelf) {
            return { ok: false, message: "Forbidden" };
        }

        if (targetUser.roleSlug === "super_admin" && currentUser.roleSlug !== "super_admin") {
            return { ok: false, message: "Only super admin can update super admin users." };
        }

        await updateUserAccountProfile({
            userId: targetUser.id,
            fullName: parsed.data.fullName,
            phoneNumber: parsed.data.phoneNumber,
        });

        await logAuditEvent({
            event: "user.update",
            actorAppUserId: currentUser.appUserId,
            targetAppUserId: targetUser.id,
            metadata: {
                fullNameChanged: true,
                phoneNumberProvided: Boolean(parsed.data.phoneNumber),
                ownershipEdit: targetUser.id === currentUser.appUserId,
            },
        });

        revalidatePath(`/dashboard/users/${targetUser.id}`);
        revalidatePath(`/dashboard/users/${targetUser.id}/edit`);
        revalidatePath("/dashboard/users");
        revalidatePath("/dashboard/settings");

        return {
            ok: true,
            message:
                targetUser.id === currentUser.appUserId
                    ? "Account details updated."
                    : "User account details updated.",
        };
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to update account details.";

        return { ok: false, message };
    }
}

export async function changeOwnPasswordAction(
    _prevState: AccountActionResult,
    formData: FormData,
): Promise<AccountActionResult> {
    try {
        const currentUser = await requireAppAccessContext();

        const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));

        if (!parsed.success) {
            const firstIssue = parsed.error.issues[0];
            return {
                ok: false,
                message: firstIssue?.message || "Please provide a valid new password.",
            };
        }

        const passwordUpdate = await updateOwnAuthPassword(parsed.data.password);

        if (!passwordUpdate.ok) {
            return { ok: false, message: passwordUpdate.message };
        }

        await updateUserMustResetPassword(currentUser.appUserId, false);

        await logAuditEvent({
            event: "password.change",
            actorAppUserId: currentUser.appUserId,
        });

        revalidatePath("/dashboard/settings");
        revalidatePath("/dashboard");

        return { ok: true, message: "Password changed successfully." };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to change password.";

        return { ok: false, message };
    }
}

export async function softDeleteUserAction(
    _prevState: SoftDeleteUserActionResult,
    formData: FormData,
): Promise<SoftDeleteUserActionResult> {
    let deletedUserId: string | null = null;

    try {
        const currentUser = await requirePermission("user.delete");

        const parsed = softDeleteUserSchema.safeParse(Object.fromEntries(formData));

        if (!parsed.success) {
            return { ok: false, message: "User id is required." };
        }

        const targetUser = await getUserWithRoleById(parsed.data.userId);

        if (!targetUser) {
            return { ok: false, message: "User was not found." };
        }

        if (currentUser.appUserId === targetUser.id) {
            return { ok: false, message: "You cannot delete your own account." };
        }

        if (targetUser.roleSlug === "super_admin" && targetUser.isActive) {
            const activeSuperAdminCount = await countActiveSuperAdminUsers();

            if (activeSuperAdminCount <= 1) {
                return { ok: false, message: "Cannot delete the last active super admin account." };
            }
        }

        const deletedAt = new Date();
        const deletedEmail = `${targetUser.email}_deleted_${deletedAt.getTime()}`;

        await softDeleteUserWithProfiles({
            userId: parsed.data.userId,
            deletedEmail,
            deletedAt,
        });

        const authDelete = await deleteAuthUser(targetUser.supabaseUserId);

        await logAuditEvent({
            event: "user.delete",
            actorAppUserId: currentUser.appUserId,
            targetAppUserId: parsed.data.userId,
            metadata: {
                authDeleteError: authDelete.error?.message ?? null,
                authUserDeleted: authDelete.ok,
                deletedEmail,
                softDeleted: true,
            },
        });
        deletedUserId = parsed.data.userId;
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to delete user.";

        return { ok: false, message };
    }

    revalidatePath("/dashboard/users");
    revalidatePath(`/dashboard/users/${deletedUserId}`);
    revalidatePath(`/dashboard/users/${deletedUserId}/edit`);
    revalidatePath("/dashboard/merchants");
    revalidatePath("/dashboard/riders");
    revalidatePath("/dashboard/settings");

    redirect("/dashboard/users");
}
