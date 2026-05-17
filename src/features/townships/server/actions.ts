"use server";

import { revalidatePath } from "next/cache";

import { createTownship, updateTownship } from "@/features/townships/server/dal";
import { townshipInputSchema, updateTownshipInputSchema } from "@/features/townships/server/dto";
import { canManageTownshipPricing } from "@/lib/permissions";
import { requireCurrentUser } from "@/lib/session";

export async function createTownshipAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = townshipInputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid township pricing details.",
    };
  }

  const validatedInput = parseResult.data;

  if (!canManageTownshipPricing(actor.role)) {
    return {
      ok: false as const,
      message: "You do not have permission to manage township pricing.",
    };
  }

  const township = await createTownship(validatedInput);

  revalidatePath("/dashboard/townships");
  revalidatePath("/dashboard/parcels");

  return {
    ok: true as const,
    message: "Township pricing saved.",
    township,
  };
}

export async function updateTownshipAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = updateTownshipInputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid township pricing details.",
    };
  }

  const validatedInput = parseResult.data;

  if (!canManageTownshipPricing(actor.role)) {
    return {
      ok: false as const,
      message: "You do not have permission to manage township pricing.",
    };
  }

  const township = await updateTownship(validatedInput.id, validatedInput);

  if (!township) {
    return {
      ok: false as const,
      message: "Township was not found.",
    };
  }

  revalidatePath("/dashboard/townships");
  revalidatePath("/dashboard/parcels");

  return {
    ok: true as const,
    message: "Township pricing saved.",
    township,
  };
}
