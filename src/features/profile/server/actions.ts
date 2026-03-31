"use server";

import "server-only";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { changePasswordSchema, updateProfileSchema } from "./utils";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { requireCurrentUser } from "@/features/auth/server/utils";
import { logAuditEvent } from "@/lib/security/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { ProfileActionResult } from "./dto";

function mapPasswordUpdateError(error: { message?: string; code?: string; status?: number }) {
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

export async function updateOwnProfileAction(
  _prevState: ProfileActionResult,
  formData: FormData,
): Promise<ProfileActionResult> {
  try {
    const user = await requireCurrentUser();

    const parsed = updateProfileSchema.safeParse({
      fullName: formData.get("fullName"),
      phoneNumber: formData.get("phoneNumber"),
    });

    if (!parsed.success) {
      return { ok: false, message: "Please provide valid profile data." };
    }

    await db
      .update(appUsers)
      .set({
        fullName: parsed.data.fullName,
        phoneNumber: parsed.data.phoneNumber,
      })
      .where(eq(appUsers.id, user.appUserId));

    await logAuditEvent({
      event: "profile.update",
      actorAppUserId: user.appUserId,
      metadata: {
        phoneNumberProvided: Boolean(parsed.data.phoneNumber),
      },
    });
    revalidatePath("/dashboard/profile");

    return { ok: true, message: "Profile updated." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update profile.";

    return { ok: false, message };
  }
}

export async function changeOwnPasswordAction(
  _prevState: ProfileActionResult,
  formData: FormData,
): Promise<ProfileActionResult> {
  try {
    const user = await requireCurrentUser();

    const parsed = changePasswordSchema.safeParse({
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    });

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return { ok: false, message: firstIssue?.message || "Please provide a valid new password." };
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

    if (error) {
      return { ok: false, message: mapPasswordUpdateError(error) };
    }

    await db
      .update(appUsers)
      .set({ mustResetPassword: false })
      .where(eq(appUsers.id, user.appUserId));

    await logAuditEvent({
      event: "password.change",
      actorAppUserId: user.appUserId,
    });
    revalidatePath("/dashboard/profile");
    revalidatePath("/dashboard");

    return { ok: true, message: "Password changed successfully." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to change password.";

    return { ok: false, message };
  }
}
