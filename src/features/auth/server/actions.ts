"use server";

import { z } from "zod";

import { userRoles } from "@/lib/domain";
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

export async function regeneratePasswordAction(targetRole: (typeof userRoles)[number]) {
  const actor = await requireCurrentUser();

  if (!canRegeneratePassword(actor.role, targetRole)) {
    throw new Error("You do not have permission to regenerate this password.");
  }

  return {
    temporaryPassword: generateTemporaryPassword(),
    mustResetPassword: true,
  };
}
