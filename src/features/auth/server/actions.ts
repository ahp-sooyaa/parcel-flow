"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { getUserById } from "@/features/users/server/dal";
import { auth } from "@/lib/auth";
import { getFormFieldErrors } from "@/lib/form-action-errors";
import { canRegeneratePassword } from "@/lib/permissions";
import { generateTemporaryPassword } from "@/lib/password";
import { assertDemoAllowed, DEMO_RESTRICTED_MESSAGE, isDemoRestricted } from "@/lib/demo";
import { requireCurrentUser } from "@/lib/session";
import { eq } from "drizzle-orm";
import { maxLengthMessage, TEXT_LIMITS } from "@/lib/validation";

const updateOwnPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required.").max(TEXT_LIMITS.password),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters.")
      .max(TEXT_LIMITS.password, maxLengthMessage("New password", TEXT_LIMITS.password)),
  })
  .superRefine((value, ctx) => {
    if (value.currentPassword === value.newPassword) {
      ctx.addIssue({
        code: "custom",
        message: "New password must be different from current password.",
        path: ["newPassword"],
      });
    }
  });

const regeneratePasswordSchema = z.object({
  targetUserId: z.string().min(1),
});

export type PasswordSettingsFormState = {
  ok: boolean;
  message: string | null;
  fieldErrors?: Partial<Record<"currentPassword" | "newPassword", string>>;
};

export async function updateOwnPasswordAction(input: unknown) {
  const actor = await requireCurrentUser();

  if (isDemoRestricted(actor)) {
    return { ok: false as const, message: DEMO_RESTRICTED_MESSAGE, fieldErrors: undefined };
  }
  const parsedInput = updateOwnPasswordSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false as const,
      message: parsedInput.error.issues[0]?.message ?? "Invalid password details.",
      fieldErrors: getFormFieldErrors(parsedInput.error) as Partial<
        Record<"currentPassword" | "newPassword", string>
      >,
    };
  }

  try {
    await auth.api.changePassword({
      body: {
        currentPassword: parsedInput.data.currentPassword,
        newPassword: parsedInput.data.newPassword,
        revokeOtherSessions: true,
      },
      headers: await headers(),
    });
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Unable to update password right now.",
    };
  }

  await db
    .update(appUsers)
    .set({ mustResetPassword: false, updatedAt: new Date() })
    .where(eq(appUsers.id, actor.id));

  revalidatePath("/dashboard/settings");

  return {
    ok: true as const,
    message: "Password updated.",
  };
}

export async function updateOwnPasswordFormAction(
  _previousState: PasswordSettingsFormState,
  formData: FormData,
): Promise<PasswordSettingsFormState> {
  const result = await updateOwnPasswordAction({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });

  return {
    ok: result.ok,
    message: result.message,
    fieldErrors: result.fieldErrors,
  };
}

export async function regeneratePasswordAction(input: unknown) {
  const actor = await requireCurrentUser();
  assertDemoAllowed(actor);
  const parseResult = regeneratePasswordSchema.safeParse(input);

  if (!parseResult.success) {
    throw new Error(parseResult.error.issues[0]?.message ?? "Invalid password reset request.");
  }

  const targetUser = await getUserById(parseResult.data.targetUserId);

  if (!targetUser) {
    throw new Error("User was not found.");
  }

  if (!canRegeneratePassword(actor.role, targetUser.role)) {
    throw new Error("You do not have permission to regenerate this password.");
  }

  const temporaryPassword = generateTemporaryPassword();

  await auth.api.setUserPassword({
    body: {
      userId: targetUser.id,
      newPassword: temporaryPassword,
    },
    headers: await headers(),
  });

  await db
    .update(appUsers)
    .set({ mustResetPassword: true, updatedAt: new Date() })
    .where(eq(appUsers.id, targetUser.id));

  revalidatePath("/dashboard/users");

  return {
    temporaryPassword,
    mustResetPassword: true,
  };
}

export async function signOutAction() {
  await auth.api.signOut({
    headers: await headers(),
  });

  redirect("/login");
}
