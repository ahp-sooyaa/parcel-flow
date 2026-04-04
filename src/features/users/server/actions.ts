"use server";

import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { countActiveSuperAdminUsers, getUserStatusGuardContext } from "./dal";
import {
  createUserSchema,
  parseActiveFlag,
  softDeleteUserSchema,
  updateUserProfileSchema,
} from "./utils";
import { db } from "@/db";
import { appUsers, merchants, riders } from "@/db/schema";
import { findRoleBySlug, findAppUserById } from "@/features/auth/server/dal";
import { requirePermission } from "@/features/auth/server/utils";
import { createMerchantProfile } from "@/features/merchant/server/dal";
import { createRiderProfile } from "@/features/rider/server/dal";
import { findTownshipById } from "@/features/townships/server/dal";
import { logAuditEvent } from "@/lib/security/audit";
import { generateStrongPassword } from "@/lib/security/password";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import type {
  CreateUserActionResult,
  ResetUserPasswordActionResult,
  SoftDeleteUserActionResult,
  UpdateUserProfileActionResult,
} from "./dto";

type CreateUserInput = ReturnType<typeof createUserSchema.parse>;

async function parseCreateUserInput(formData: FormData) {
  return createUserSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phoneNumber: formData.get("phoneNumber"),
    role: formData.get("role"),
    isActive: parseActiveFlag(formData.get("isActive")),
    merchantShopName: formData.get("merchantShopName"),
    merchantPickupTownshipId: formData.get("merchantPickupTownshipId"),
    merchantDefaultPickupAddress: formData.get("merchantDefaultPickupAddress"),
    merchantNotes: formData.get("merchantNotes"),
    riderTownshipId: formData.get("riderTownshipId"),
    riderVehicleType: formData.get("riderVehicleType"),
    riderLicensePlate: formData.get("riderLicensePlate"),
    riderNotes: formData.get("riderNotes"),
    riderIsActive: parseActiveFlag(formData.get("riderIsActive")),
  });
}

async function validateUserRoleAndTownships(input: CreateUserInput, currentUserRoleSlug: string) {
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

  const townshipChecks = [
    {
      townshipId: input.merchantPickupTownshipId,
      message: "Selected merchant township was not found.",
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
      return { ok: false as const, message: check.message };
    }
  }

  return { ok: true as const, role };
}

async function provisionAuthUser(input: CreateUserInput, temporaryPassword: string) {
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

async function createAppUserWithProfiles(params: {
  input: CreateUserInput;
  roleId: string;
  supabaseUserId: string;
}) {
  const { input, roleId, supabaseUserId } = params;
  let createdAppUserId: string | null = null;

  try {
    const [createdUser] = await db
      .insert(appUsers)
      .values({
        supabaseUserId,
        fullName: input.fullName,
        email: input.email,
        phoneNumber: input.phoneNumber,
        roleId,
        isActive: input.isActive,
        mustResetPassword: true,
      })
      .returning({ id: appUsers.id });

    createdAppUserId = createdUser.id;

    if (input.role === "merchant") {
      await createMerchantProfile({
        appUserId: createdAppUserId,
        shopName: input.merchantShopName ?? input.fullName,
        pickupTownshipId: input.merchantPickupTownshipId,
        defaultPickupAddress: input.merchantDefaultPickupAddress,
        notes: input.merchantNotes,
      });
    }

    if (input.role === "rider") {
      await createRiderProfile({
        appUserId: createdAppUserId,
        townshipId: input.riderTownshipId,
        vehicleType: input.riderVehicleType ?? "bike",
        licensePlate: input.riderLicensePlate,
        isActive: input.riderIsActive,
        notes: input.riderNotes,
      });
    }

    return { ok: true as const, createdAppUserId };
  } catch {
    if (createdAppUserId) {
      await db.delete(appUsers).where(eq(appUsers.id, createdAppUserId));
    }

    return { ok: false as const, message: "Failed to store app user profile." };
  }
}

export async function createUserAction(
  _prevState: CreateUserActionResult,
  formData: FormData,
): Promise<CreateUserActionResult> {
  try {
    const currentUser = await requirePermission("user.create");
    const parsed = await parseCreateUserInput(formData);

    if (!parsed.success) {
      return { ok: false, message: "Please provide valid user details." };
    }

    const guards = await validateUserRoleAndTownships(parsed.data, currentUser.role.slug);

    if (!guards.ok) {
      return { ok: false, message: guards.message };
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
      await authUser.supabaseAdmin.auth.admin.deleteUser(authUser.supabaseUserId);

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
        merchantTownshipId: parsed.data.merchantPickupTownshipId,
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

  const targetUser = await getUserStatusGuardContext(userId);

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

export async function updateUserProfileAction(
  _prevState: UpdateUserProfileActionResult,
  formData: FormData,
): Promise<UpdateUserProfileActionResult> {
  try {
    const currentUser = await requirePermission("user.update");
    const parsed = updateUserProfileSchema.safeParse({
      userId: formData.get("userId"),
      fullName: formData.get("fullName"),
      phoneNumber: formData.get("phoneNumber"),
    });

    if (!parsed.success) {
      return { ok: false, message: "Please provide valid user profile data." };
    }

    const targetUser = await getUserStatusGuardContext(parsed.data.userId);

    if (!targetUser) {
      return { ok: false, message: "User was not found." };
    }

    if (targetUser.roleSlug === "super_admin" && currentUser.role.slug !== "super_admin") {
      return { ok: false, message: "Only super admin can update super admin users." };
    }

    await db
      .update(appUsers)
      .set({
        fullName: parsed.data.fullName,
        phoneNumber: parsed.data.phoneNumber,
        updatedAt: new Date(),
      })
      .where(and(eq(appUsers.id, parsed.data.userId), isNull(appUsers.deletedAt)));

    await logAuditEvent({
      event: "user.update",
      actorAppUserId: currentUser.appUserId,
      targetAppUserId: parsed.data.userId,
      metadata: {
        fullNameChanged: true,
        phoneNumberProvided: Boolean(parsed.data.phoneNumber),
      },
    });

    revalidatePath(`/dashboard/users/${parsed.data.userId}`);
    revalidatePath(`/dashboard/users/${parsed.data.userId}/edit`);
    revalidatePath("/dashboard/users");
    revalidatePath("/dashboard/profile");

    return { ok: true, message: "User profile updated." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update user profile.";

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

    if (currentUser.role.slug !== "super_admin") {
      return { ok: false, message: "Only super admin can delete users." };
    }

    const parsed = softDeleteUserSchema.safeParse({
      userId: formData.get("userId"),
    });

    if (!parsed.success) {
      return { ok: false, message: "User id is required." };
    }

    const targetUser = await getUserStatusGuardContext(parsed.data.userId);

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

    const targetAppUser = await findAppUserById(parsed.data.userId);

    if (!targetAppUser) {
      return { ok: false, message: "User was not found." };
    }

    const deletedAt = new Date();
    const deletedEmail = `${targetAppUser.email}_deleted_${deletedAt.getTime()}`;
    const supabaseAdmin = createSupabaseAdminClient();
    const { error } = await supabaseAdmin.auth.admin.deleteUser(targetAppUser.supabaseUserId);

    if (error) {
      return { ok: false, message: "Failed to delete auth user." };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(appUsers)
        .set({
          email: deletedEmail,
          isActive: false,
          deletedAt,
          updatedAt: deletedAt,
        })
        .where(and(eq(appUsers.id, parsed.data.userId), isNull(appUsers.deletedAt)));

      await tx
        .update(merchants)
        .set({
          deletedAt,
          updatedAt: deletedAt,
        })
        .where(and(eq(merchants.appUserId, parsed.data.userId), isNull(merchants.deletedAt)));

      await tx
        .update(riders)
        .set({
          deletedAt,
          updatedAt: deletedAt,
        })
        .where(and(eq(riders.appUserId, parsed.data.userId), isNull(riders.deletedAt)));
    });

    await logAuditEvent({
      event: "user.delete",
      actorAppUserId: currentUser.appUserId,
      targetAppUserId: parsed.data.userId,
      metadata: {
        authUserDeleted: true,
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
  revalidatePath("/dashboard/profile");

  redirect("/dashboard/users");
}
