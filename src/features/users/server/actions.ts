"use server";

import { headers } from "next/headers";
import { revalidatePath, updateTag } from "next/cache";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { appUsers } from "@/db/schema";
import {
  createBankAccountForUser,
  createRoleProfile,
  findUniqueUsername,
  getUserById,
  updateBankAccountForUser,
  updateUserProfile,
} from "@/features/users/server/dal";
import {
  type BankAccountDto,
  bankAccountInputSchema,
  createUserBankAccountInputSchema,
  createUserInputSchema,
  updateOwnAccountInputSchema,
  updateOwnBankAccountInputSchema,
  updateUserBankAccountInputSchema,
  updateUserInputSchema,
} from "@/features/users/server/dto";
import { buildInternalEmail, normalizePhoneNumber } from "@/features/users/server/utils";
import { auth } from "@/lib/auth";
import {
  invalidateMerchantListCaches,
  invalidateRiderListCaches,
  invalidateTownshipCaches,
  invalidateUserListCaches,
} from "@/lib/cache-invalidation";
import { userBanksTag, userProfileTag } from "@/lib/cache-tags";
import { getFormFieldErrors } from "@/lib/form-action-errors";
import { canCreateUser, canManageUser } from "@/lib/permissions";
import { requireCurrentUser } from "@/lib/session";

type BankAccountActionResult =
  | { ok: false; message: string; fieldErrors?: Partial<Record<string, string>> }
  | { ok: true; message: string; bankAccount: BankAccountDto };

export type AccountSettingsFormState = {
  ok: boolean;
  message: string | null;
  values: {
    name: string;
    phoneNumber: string;
    address: string;
    age: string;
  };
};

export async function createUserAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = createUserInputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid user details.",
      fieldErrors: getFormFieldErrors(parseResult.error),
    };
  }

  const validatedInput = parseResult.data;

  if (!canCreateUser(actor.role, validatedInput.role)) {
    return {
      ok: false as const,
      message: "You do not have permission to create this account type.",
    };
  }

  const username = await findUniqueUsername(validatedInput.name);
  const email = buildInternalEmail(username);
  const createdUser = await auth.api.createUser({
    body: {
      name: validatedInput.name,
      email,
      password: validatedInput.password,
      role: validatedInput.role,
      data: {
        username,
        displayUsername: username,
        phoneNumber: normalizePhoneNumber(validatedInput.phoneNumber),
        address: validatedInput.address,
        age: validatedInput.age,
        isActive: true,
        mustResetPassword: true,
      },
    },
    headers: await headers(),
  });

  await createRoleProfile({
    userId: createdUser.user.id,
    role: validatedInput.role,
    shopName: validatedInput.shopName,
    address: validatedInput.address,
    serviceTownshipId: validatedInput.serviceTownshipId,
  });

  revalidatePath("/dashboard/users");
  revalidatePath("/dashboard/merchants");
  revalidatePath("/dashboard/riders");
  invalidateUserListCaches();
  invalidateMerchantListCaches();
  invalidateRiderListCaches();
  invalidateTownshipCaches();

  return {
    ok: true as const,
    message: "User account created.",
    temporaryPassword: validatedInput.password,
    user: {
      ...validatedInput,
      id: createdUser.user.id,
      username,
      email,
    },
  };
}

export async function updateUserAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = updateUserInputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid user details.",
      fieldErrors: getFormFieldErrors(parseResult.error),
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

  const user = await updateUserProfile(validatedInput);

  revalidatePath("/dashboard/users");
  revalidatePath("/dashboard/merchants");
  revalidatePath("/dashboard/riders");
  invalidateUserListCaches();
  invalidateMerchantListCaches();
  invalidateRiderListCaches();
  updateTag(userProfileTag(validatedInput.id));

  return {
    ok: true as const,
    message: "User details saved.",
    user,
  };
}

export async function updateOwnAccountAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = updateOwnAccountInputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid account details.",
      fieldErrors: getFormFieldErrors(parseResult.error),
    };
  }

  const validatedInput = parseResult.data;

  await db
    .update(appUsers)
    .set({
      name: validatedInput.name,
      phoneNumber: normalizePhoneNumber(validatedInput.phoneNumber),
      address: validatedInput.address,
      age: validatedInput.age ?? null,
      updatedAt: new Date(),
    })
    .where(eq(appUsers.id, actor.id));

  revalidatePath("/dashboard/settings");
  updateTag(userProfileTag(actor.id));
  invalidateUserListCaches();
  invalidateMerchantListCaches();
  invalidateRiderListCaches();

  return {
    ok: true as const,
    message: "Account details saved.",
    user: validatedInput,
  };
}

export async function updateOwnAccountFormAction(
  _previousState: AccountSettingsFormState,
  formData: FormData,
): Promise<AccountSettingsFormState> {
  const values = {
    name: getFormDataString(formData, "name"),
    phoneNumber: getFormDataString(formData, "phoneNumber"),
    address: getFormDataString(formData, "address"),
    age: getFormDataString(formData, "age"),
  };
  const result = await updateOwnAccountAction(values);

  return {
    ok: result.ok,
    message: result.message,
    values,
  };
}

function getFormDataString(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

export async function createOwnBankAccountAction(input: unknown): Promise<BankAccountActionResult> {
  const actor = await requireCurrentUser();
  const parseResult = bankAccountInputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid bank account details.",
      fieldErrors: getFormFieldErrors(parseResult.error),
    };
  }

  if (actor.role !== "super_admin") {
    return {
      ok: false as const,
      message: "Only super admins can manage bank accounts.",
    };
  }

  const bankAccount = await createBankAccountForUser({
    userId: actor.id,
    ...parseResult.data,
    isCompanyAccount: true,
  });

  revalidatePath("/dashboard/settings");
  updateTag(userBanksTag(actor.id));

  return {
    ok: true as const,
    message: "Bank account saved.",
    bankAccount,
  };
}

export async function updateOwnBankAccountAction(input: unknown): Promise<BankAccountActionResult> {
  const actor = await requireCurrentUser();
  const parseResult = updateOwnBankAccountInputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid bank account details.",
      fieldErrors: getFormFieldErrors(parseResult.error),
    };
  }

  if (actor.role !== "super_admin") {
    return {
      ok: false as const,
      message: "Only super admins can manage bank accounts.",
    };
  }

  const bankAccount = await updateBankAccountForUser({
    ...parseResult.data,
    userId: actor.id,
    isCompanyAccount: true,
  });

  if (!bankAccount) {
    return {
      ok: false as const,
      message: "Bank account was not found.",
    };
  }

  revalidatePath("/dashboard/settings");
  updateTag(userBanksTag(actor.id));

  return {
    ok: true as const,
    message: "Bank account saved.",
    bankAccount,
  };
}

export async function createUserBankAccountAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = createUserBankAccountInputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid bank account details.",
      fieldErrors: getFormFieldErrors(parseResult.error),
    };
  }

  const validatedInput = parseResult.data;
  const targetUser = await getUserById(validatedInput.userId);

  if (!targetUser) {
    return {
      ok: false as const,
      message: "User was not found.",
    };
  }

  if (actor.role !== "super_admin" || !canManageUser(actor.role, targetUser.role)) {
    return {
      ok: false as const,
      message: "Only super admins can manage bank accounts.",
    };
  }

  const bankAccount = await createBankAccountForUser({
    ...validatedInput,
    isCompanyAccount: false,
  });

  revalidatePath("/dashboard/users");
  updateTag(userBanksTag(validatedInput.userId));
  invalidateUserListCaches();

  return {
    ok: true as const,
    message: "Bank account saved.",
    bankAccount,
  };
}

export async function updateUserBankAccountAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = updateUserBankAccountInputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid bank account details.",
      fieldErrors: getFormFieldErrors(parseResult.error),
    };
  }

  const validatedInput = parseResult.data;
  const targetUser = await getUserById(validatedInput.userId);

  if (!targetUser) {
    return {
      ok: false as const,
      message: "User was not found.",
    };
  }

  if (actor.role !== "super_admin" || !canManageUser(actor.role, targetUser.role)) {
    return {
      ok: false as const,
      message: "Only super admins can manage bank accounts.",
    };
  }

  const bankAccount = await updateBankAccountForUser({
    ...validatedInput,
    isCompanyAccount: false,
  });

  if (!bankAccount) {
    return {
      ok: false as const,
      message: "Bank account was not found.",
    };
  }

  revalidatePath("/dashboard/users");
  updateTag(userBanksTag(validatedInput.userId));
  invalidateUserListCaches();

  return {
    ok: true as const,
    message: "Bank account saved.",
    bankAccount,
  };
}
