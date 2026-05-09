"use server";

import { z } from "zod";

import { userRoles } from "@/lib/domain";
import { canRegeneratePassword } from "@/lib/permissions";
import { requireCurrentUser } from "@/lib/session";

export const createUserSchema = z.object({
  name: z.string().min(1),
  phoneNumber: z.string().min(5),
  email: z.string().email().optional(),
  role: z.enum(userRoles),
  password: z.string().min(8),
});

export async function createUserAction(input: unknown) {
  return {
    ok: true,
    user: createUserSchema.parse(input),
  };
}

export async function regeneratePasswordAction(targetRole: (typeof userRoles)[number]) {
  const actor = await requireCurrentUser();

  if (!canRegeneratePassword(actor.role, targetRole)) {
    throw new Error("You do not have permission to regenerate this password.");
  }

  return {
    temporaryPassword: "PF-temp-1234",
    mustResetPassword: true,
  };
}
