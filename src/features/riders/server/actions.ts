"use server";

import { upsertRiderInputSchema } from "@/features/riders/server/dto";
import { canManageRiderProfiles } from "@/lib/permissions";
import { requireCurrentUser } from "@/lib/session";

export async function upsertRiderAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = upsertRiderInputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid rider details.",
    };
  }

  if (!canManageRiderProfiles(actor.role)) {
    return {
      ok: false as const,
      message: "You do not have permission to manage riders.",
    };
  }

  const validatedInput = parseResult.data;

  return {
    ok: true as const,
    message: "Rider details validated.",
    rider: validatedInput,
  };
}
