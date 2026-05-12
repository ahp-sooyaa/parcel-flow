"use server";

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

  return {
    ok: true as const,
    message: "Township pricing validated.",
    township: validatedInput,
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

  return {
    ok: true as const,
    message: "Township pricing validated.",
    township: validatedInput,
  };
}
