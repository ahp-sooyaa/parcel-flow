"use server";

import "server-only";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createUserSchema, parseActiveFlag } from "./utils";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { findRoleBySlug, findAppUserById } from "@/features/auth/server/dal";
import { requirePermission } from "@/features/auth/server/utils";
import { logAuditEvent } from "@/lib/security/audit";
import { generateStrongPassword } from "@/lib/security/password";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import type { CreateUserActionResult, ResetUserPasswordActionResult } from "./dto";

export async function createUserAction(
  _prevState: CreateUserActionResult,
  formData: FormData,
): Promise<CreateUserActionResult> {
  try {
    const currentUser = await requirePermission("user.create");

    const parsed = createUserSchema.safeParse({
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      phoneNumber: formData.get("phoneNumber"),
      role: formData.get("role"),
      isActive: parseActiveFlag(formData.get("isActive")),
    });

    if (!parsed.success) {
      return { ok: false, message: "Please provide valid user details." };
    }

    const role = await findRoleBySlug(parsed.data.role);

    if (!role) {
      return { ok: false, message: "Selected role was not found." };
    }

    if (parsed.data.role === "super_admin" && currentUser.role.slug !== "super_admin") {
      return { ok: false, message: "Only super admin can create super admin users." };
    }

    const tempPassword = generateStrongPassword(20);
    const supabaseAdmin = createSupabaseAdminClient();

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: parsed.data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: parsed.data.fullName,
      },
    });

    if (error || !data.user) {
      return { ok: false, message: "Could not provision Supabase user." };
    }

    try {
      await db.insert(appUsers).values({
        supabaseUserId: data.user.id,
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        phoneNumber: parsed.data.phoneNumber,
        roleId: role.id,
        isActive: parsed.data.isActive,
        mustResetPassword: true,
      });
    } catch {
      await supabaseAdmin.auth.admin.deleteUser(data.user.id);

      return { ok: false, message: "Failed to store app user profile." };
    }

    revalidatePath("/dashboard/users");

    await logAuditEvent({
      event: "user.create",
      actorAppUserId: currentUser.appUserId,
      metadata: {
        role: parsed.data.role,
        isActive: parsed.data.isActive,
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
    if (currentUser.role.slug !== "super_admin") {
      return { ok: false, message: "Only super admin can reset passwords." };
    }

    const userId = String(formData.get("userId") || "");

    if (!userId) {
      return { ok: false, message: "User id is required." };
    }

    const targetUser = await findAppUserById(userId);

    if (!targetUser) {
      return { ok: false, message: "User was not found." };
    }

    const temporaryPassword = generateStrongPassword(20);
    const supabaseAdmin = createSupabaseAdminClient();

    const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUser.supabaseUserId, {
      password: temporaryPassword,
    });

    if (error) {
      return { ok: false, message: "Failed to update auth password." };
    }

    await db
      .update(appUsers)
      .set({ mustResetPassword: true })
      .where(
        and(eq(appUsers.id, targetUser.id), eq(appUsers.supabaseUserId, targetUser.supabaseUserId)),
      );

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

  await db.update(appUsers).set({ isActive }).where(eq(appUsers.id, userId));

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
