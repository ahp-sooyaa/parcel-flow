"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  confirmRiderCashHandover,
  createMerchantSettlement,
  getEligibleSettlementMerchantById,
  getPendingRiderCashHandoverByRiderId,
  resolveMerchantSettlement,
} from "@/features/settlements/server/dal";
import {
  confirmRiderCashHandoverInputSchema,
  createMerchantSettlementInputSchema,
  demoResolveMerchantSettlementInputSchema,
  resolveMerchantSettlementInputSchema,
} from "@/features/settlements/server/dto";
import { uploadSettlementReceipt } from "@/features/settlements/server/upload";
import { invalidateSettlementCaches } from "@/lib/cache-invalidation";
import {
  canConfirmRiderCashHandover,
  canCreateMerchantSettlement,
  canResolveMerchantSettlement,
} from "@/lib/permissions";
import { DEMO_ASSET_KEYS, isDemoMode } from "@/lib/demo";
import { requireCurrentUser } from "@/lib/session";

const merchantIdSchema = z.uuid("Merchant selection is invalid.");
const riderIdSchema = z.uuid("Rider selection is invalid.");

function normalizeResolveSettlementInput(input: unknown) {
  if (!(input instanceof FormData)) {
    return input;
  }

  const paymentNote = input.get("paymentNote");

  return {
    settlementId: input.get("settlementId"),
    paymentNote: typeof paymentNote === "string" ? paymentNote : undefined,
    bankTransferReceipt: input.get("bankTransferReceipt"),
  };
}

export async function createMerchantSettlementAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = createMerchantSettlementInputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid settlement details.",
    };
  }

  if (!canCreateMerchantSettlement(actor.role)) {
    return {
      ok: false as const,
      message: "You do not have permission to create merchant settlements.",
    };
  }

  try {
    const settlement = await createMerchantSettlement({
      ...parseResult.data,
      createdBy: actor.id,
    });

    invalidateSettlementCaches();
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settlements");

    return {
      ok: true as const,
      message: "Pending settlement created.",
      settlement,
    };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Unable to create settlement.",
    };
  }
}

export async function confirmRiderCashHandoverAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = confirmRiderCashHandoverInputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid rider handover details.",
    };
  }

  if (!canConfirmRiderCashHandover(actor.role)) {
    return {
      ok: false as const,
      message: "You do not have permission to confirm rider cash handover.",
    };
  }

  try {
    const result = await confirmRiderCashHandover({
      ...parseResult.data,
      confirmedBy: actor.id,
    });

    invalidateSettlementCaches();
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settlements");

    return {
      ok: true as const,
      message: "Rider cash handover confirmed.",
      result,
    };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Unable to confirm rider cash handover.",
    };
  }
}

export async function resolveMerchantSettlementAction(input: unknown) {
  const actor = await requireCurrentUser();
  const demoMode = isDemoMode();
  const settlementSchema:
    | typeof resolveMerchantSettlementInputSchema
    | typeof demoResolveMerchantSettlementInputSchema = demoMode
    ? demoResolveMerchantSettlementInputSchema
    : resolveMerchantSettlementInputSchema;
  const parseResult = settlementSchema.safeParse(normalizeResolveSettlementInput(input));

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid settlement resolution details.",
    };
  }

  if (!canResolveMerchantSettlement(actor.role)) {
    return {
      ok: false as const,
      message: "You do not have permission to resolve merchant settlements.",
    };
  }

  try {
    // The public demo never stores uploads; a seeded sample receipt stands in.
    const receiptFile = parseResult.data.bankTransferReceipt;
    const receiptKey =
      demoMode || !receiptFile
        ? DEMO_ASSET_KEYS.receipt
        : await uploadSettlementReceipt({
            settlementId: parseResult.data.settlementId,
            file: receiptFile,
          });

    await resolveMerchantSettlement({
      settlementId: parseResult.data.settlementId,
      bankTransferReceiptKey: receiptKey,
      paymentNote: parseResult.data.paymentNote,
      paidBy: actor.id,
    });

    invalidateSettlementCaches();
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settlements");

    return {
      ok: true as const,
      message: "Settlement marked as paid.",
    };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Unable to resolve settlement.",
    };
  }
}

export async function getEligibleSettlementMerchantDetailAction(merchantId: unknown) {
  const actor = await requireCurrentUser();

  if (!canCreateMerchantSettlement(actor.role)) {
    throw new Error("You do not have permission to review merchant settlements.");
  }

  const parsedMerchantId = merchantIdSchema.parse(merchantId);
  const merchant = await getEligibleSettlementMerchantById(parsedMerchantId);

  if (!merchant) {
    throw new Error("Merchant settlement details were not found.");
  }

  return merchant;
}

export async function getRiderCashHandoverDetailAction(riderId: unknown) {
  const actor = await requireCurrentUser();

  if (!canConfirmRiderCashHandover(actor.role)) {
    throw new Error("You do not have permission to review rider cash handovers.");
  }

  const parsedRiderId = riderIdSchema.parse(riderId);
  const handover = await getPendingRiderCashHandoverByRiderId(parsedRiderId);

  if (!handover) {
    throw new Error("Rider cash handover details were not found.");
  }

  return handover;
}
