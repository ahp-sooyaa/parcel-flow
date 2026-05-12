"use server";

import { upsertMerchantInputSchema } from "@/features/merchants/server/dto";
import { canManageMerchantProfiles } from "@/lib/permissions";
import { requireCurrentUser } from "@/lib/session";

export async function upsertMerchantAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = upsertMerchantInputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid merchant details.",
    };
  }

  if (!canManageMerchantProfiles(actor.role)) {
    return {
      ok: false as const,
      message: "You do not have permission to manage merchants.",
    };
  }

  const validatedInput = parseResult.data;

  return {
    ok: true as const,
    message: "Merchant details validated.",
    merchant: validatedInput,
  };
}
