"use server";

import { createSettlementDraftInputSchema } from "@/features/settlements/server/dto";
import { canCreateSettlementDraft } from "@/lib/permissions";
import { requireCurrentUser } from "@/lib/session";

export async function createSettlementDraftAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = createSettlementDraftInputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid settlement details.",
    };
  }

  if (!canCreateSettlementDraft(actor.role)) {
    return {
      ok: false as const,
      message: "You do not have permission to create settlement drafts.",
    };
  }

  const validatedInput = parseResult.data;

  return {
    ok: true as const,
    message: "Settlement draft validated.",
    settlement: validatedInput,
  };
}
