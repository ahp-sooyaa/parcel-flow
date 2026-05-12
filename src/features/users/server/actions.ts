"use server";

import { getUserById } from "@/features/users/server/dal";
import {
  bankAccountInputSchema,
  createUserInputSchema,
  updateOwnAccountInputSchema,
  updateOwnBankAccountInputSchema,
  updateUserInputSchema,
} from "@/features/users/server/dto";
import { canCreateUser, canManageUser } from "@/lib/permissions";
import { requireCurrentUser } from "@/lib/session";

export async function createUserAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = createUserInputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid user details.",
    };
  }

  const validatedInput = parseResult.data;

  if (!canCreateUser(actor.role, validatedInput.role)) {
    return {
      ok: false as const,
      message: "You do not have permission to create this account type.",
    };
  }

  return {
    ok: true as const,
    message: "User details validated.",
    temporaryPassword: validatedInput.password,
    user: validatedInput,
  };
}

export async function updateUserAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = updateUserInputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid user details.",
    };
  }

  const validatedInput = parseResult.data;
  const targetUser = await getUserById(validatedInput.id);

  if (!targetUser) {
    return {
      ok: false as const,
      message: "User was not found.",
    };
  }

  if (
    !canManageUser(actor.role, targetUser.role) ||
    !canManageUser(actor.role, validatedInput.role)
  ) {
    return {
      ok: false as const,
      message: "You do not have permission to edit this account.",
    };
  }

  return {
    ok: true as const,
    message: "User details validated.",
    user: validatedInput,
  };
}

export async function updateOwnAccountAction(input: unknown) {
  await requireCurrentUser();
  const parseResult = updateOwnAccountInputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid account details.",
    };
  }

  const validatedInput = parseResult.data;

  return {
    ok: true as const,
    message: "Account details validated.",
    user: validatedInput,
  };
}

export async function createOwnBankAccountAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = bankAccountInputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid bank account details.",
    };
  }

  const validatedInput = parseResult.data;

  return {
    ok: true as const,
    message: "Bank account details validated.",
    bankAccount: {
      id: crypto.randomUUID(),
      userId: actor.id,
      ...validatedInput,
    },
  };
}

export async function updateOwnBankAccountAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = updateOwnBankAccountInputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid bank account details.",
    };
  }

  const validatedInput = parseResult.data;

  return {
    ok: true as const,
    message: "Bank account details validated.",
    bankAccount: {
      userId: actor.id,
      ...validatedInput,
    },
  };
}
