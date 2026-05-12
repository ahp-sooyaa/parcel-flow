"use server";

import { createRiderPayoutDraftInputSchema } from "@/features/rider-payouts/server/dto";
import { calculateRiderPayout } from "@/features/riders/server/utils";
import { canCreateRiderPayoutDraft } from "@/lib/permissions";
import { requireCurrentUser } from "@/lib/session";

export async function createRiderPayoutDraftAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = createRiderPayoutDraftInputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid rider payout details.",
    };
  }

  if (!canCreateRiderPayoutDraft(actor.role)) {
    return {
      ok: false as const,
      message: "You do not have permission to create rider payout drafts.",
    };
  }

  const validatedInput = parseResult.data;

  return {
    ok: true as const,
    message: "Rider payout draft validated.",
    payout: {
      ...validatedInput,
      totalPayoutAmount: calculateRiderPayout(
        validatedInput.deliveredWayCount,
        validatedInput.feePerWay,
      ),
    },
  };
}
