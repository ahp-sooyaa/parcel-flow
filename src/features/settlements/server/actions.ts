"use server";

import { revalidatePath } from "next/cache";

import {
  confirmRiderCashHandover,
  createMerchantSettlement,
  resolveMerchantSettlement,
} from "@/features/settlements/server/dal";
import {
  confirmRiderCashHandoverInputSchema,
  createMerchantSettlementInputSchema,
  resolveMerchantSettlementInputSchema,
} from "@/features/settlements/server/dto";
import { uploadSettlementReceipt } from "@/features/settlements/server/upload";
import {
  canConfirmRiderCashHandover,
  canCreateMerchantSettlement,
  canResolveMerchantSettlement,
} from "@/lib/permissions";
import { requireCurrentUser } from "@/lib/session";

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
  const parseResult = resolveMerchantSettlementInputSchema.safeParse(
    normalizeResolveSettlementInput(input),
  );

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
    const receiptKey = await uploadSettlementReceipt({
      settlementId: parseResult.data.settlementId,
      file: parseResult.data.bankTransferReceipt,
    });

    await resolveMerchantSettlement({
      settlementId: parseResult.data.settlementId,
      bankTransferReceiptKey: receiptKey,
      paymentNote: parseResult.data.paymentNote,
      paidBy: actor.id,
    });

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
