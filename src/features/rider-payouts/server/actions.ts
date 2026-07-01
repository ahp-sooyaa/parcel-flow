"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import {
  cancelRiderPayoutDraft,
  createRiderPayoutDraft,
  getEligibleRiderPayoutItemsByRiderId,
  listEligibleRiderPayoutRiderSummaries,
  settleRiderPayout,
} from "@/features/rider-payouts/server/dal";
import {
  cancelRiderPayoutInputSchema,
  createRiderPayoutDraftInputSchema,
  settleRiderPayoutInputSchema,
} from "@/features/rider-payouts/server/dto";
import {
  canCancelRiderPayoutDraft,
  canCreateRiderPayoutDraft,
  canSettleRiderPayout,
} from "@/lib/permissions";
import { requireCurrentUser } from "@/lib/session";

function validationFailure(error: z.ZodError) {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (typeof field === "string" && fieldErrors[field] === undefined) {
      fieldErrors[field] = issue.message;
    }
  }

  return {
    ok: false as const,
    message: error.issues[0]?.message ?? "Invalid rider payout details.",
    fieldErrors,
  };
}

function revalidateRiderPayoutPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/parcels");
  revalidatePath("/dashboard/rider-payouts");
}

export async function listEligibleRiderPayoutRiderSummariesAction() {
  const actor = await requireCurrentUser();

  if (!canCreateRiderPayoutDraft(actor.role)) {
    return {
      ok: false as const,
      message: "You do not have permission to view rider payout eligibility.",
    };
  }

  try {
    const riders = await listEligibleRiderPayoutRiderSummaries();

    return {
      ok: true as const,
      riders,
    };
  } catch (error) {
    return {
      ok: false as const,
      message:
        error instanceof Error ? error.message : "Unable to load eligible rider payout riders.",
    };
  }
}

export async function getEligibleRiderPayoutRiderDetailAction(riderId: string) {
  const actor = await requireCurrentUser();

  if (!canCreateRiderPayoutDraft(actor.role)) {
    return {
      ok: false as const,
      message: "You do not have permission to view rider payout eligibility.",
    };
  }

  try {
    const financialItems = await getEligibleRiderPayoutItemsByRiderId(riderId);

    return {
      ok: true as const,
      financialItems,
    };
  } catch (error) {
    return {
      ok: false as const,
      message:
        error instanceof Error ? error.message : "Unable to load eligible rider payout items.",
    };
  }
}

export async function createRiderPayoutDraftAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = createRiderPayoutDraftInputSchema.safeParse(input);

  if (!parseResult.success) {
    return validationFailure(parseResult.error);
  }

  if (!canCreateRiderPayoutDraft(actor.role)) {
    return {
      ok: false as const,
      message: "You do not have permission to create rider payout drafts.",
    };
  }

  try {
    const payout = await createRiderPayoutDraft({
      ...parseResult.data,
      createdBy: actor.id,
    });
    revalidateRiderPayoutPaths();

    return {
      ok: true as const,
      message: "Rider payout draft created.",
      payout,
    };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Unable to create rider payout draft.",
    };
  }
}

export async function settleRiderPayoutAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = settleRiderPayoutInputSchema.safeParse(input);

  if (!parseResult.success) {
    return validationFailure(parseResult.error);
  }

  if (!canSettleRiderPayout(actor.role)) {
    return {
      ok: false as const,
      message: "You do not have permission to settle rider payouts.",
    };
  }

  try {
    await settleRiderPayout({
      ...parseResult.data,
      paidBy: actor.id,
    });
    revalidateRiderPayoutPaths();

    return {
      ok: true as const,
      message: "Rider payout marked as paid.",
    };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Unable to settle rider payout.",
    };
  }
}

export async function cancelRiderPayoutDraftAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = cancelRiderPayoutInputSchema.safeParse(input);

  if (!parseResult.success) {
    return validationFailure(parseResult.error);
  }

  if (!canCancelRiderPayoutDraft(actor.role)) {
    return {
      ok: false as const,
      message: "You do not have permission to cancel rider payout drafts.",
    };
  }

  try {
    await cancelRiderPayoutDraft(parseResult.data);
    revalidateRiderPayoutPaths();

    return {
      ok: true as const,
      message: "Rider payout draft canceled.",
    };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Unable to cancel rider payout draft.",
    };
  }
}
