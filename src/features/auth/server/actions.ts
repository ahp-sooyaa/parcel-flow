"use server";

import { z } from "zod";

import { getUserById } from "@/features/users/server/dal";
import { canRegeneratePassword } from "@/lib/permissions";
import { generateTemporaryPassword } from "@/lib/password";
import { requireCurrentUser } from "@/lib/session";

const updateOwnPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z.string().min(8, "New password must be at least 8 characters."),
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

export async function updateOwnPasswordAction(input: unknown) {
  await requireCurrentUser();
  const parsedInput = updateOwnPasswordSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false as const,
      message: parsedInput.error.issues[0]?.message ?? "Invalid password details.",
    };
  }

  return {
    ok: true as const,
    message: "Password details validated.",
  };
}

export async function regeneratePasswordAction(input: unknown) {
  const actor = await requireCurrentUser();
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

  return {
    temporaryPassword: generateTemporaryPassword(),
    mustResetPassword: true,
  };
}
