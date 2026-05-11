"use server";

import { z } from "zod";

import { creatableUserRoles, userRoles } from "@/lib/domain";
import { canCreateUser, canManageUser, canRegeneratePassword } from "@/lib/permissions";
import { generateTemporaryPassword } from "@/lib/password";
import { requireCurrentUser } from "@/lib/session";

const optionalTrimmedString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length === 0 ? undefined : trimmedValue;
}, z.string().min(1).optional());

const optionalAge = z.preprocess((value) => {
  if (value === "" || value == null) {
    return undefined;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return value;
}, z.number().int().positive().optional());

const userProfileSchema = z.object({
  name: z.string().trim().min(1),
  phoneNumber: z.string().trim().min(5),
  address: z.string().trim().min(1),
  age: optionalAge,
  isActive: z.boolean(),
  shopName: optionalTrimmedString,
  serviceTownshipId: optionalTrimmedString,
});

function validateRoleSpecificProfile(
  value: { role: (typeof userRoles)[number]; shopName?: string; serviceTownshipId?: string },
  ctx: z.RefinementCtx,
) {
  if (value.role === "merchant" && !value.shopName) {
    ctx.addIssue({
      code: "custom",
      message: "Shop is required for merchant accounts.",
      path: ["shopName"],
    });
  }

  if (value.role === "rider" && !value.serviceTownshipId) {
    ctx.addIssue({
      code: "custom",
      message: "Service township is required for rider accounts.",
      path: ["serviceTownshipId"],
    });
  }
}

const createUserSchema = userProfileSchema
  .extend({
    role: z.enum(creatableUserRoles),
    password: z.string().min(8),
  })
  .superRefine((value, ctx) => {
    validateRoleSpecificProfile(value, ctx);
  });

const updateUserSchema = userProfileSchema
  .extend({
    id: z.string().min(1),
    currentRole: z.enum(userRoles),
    role: z.enum(userRoles),
  })
  .superRefine((value, ctx) => {
    validateRoleSpecificProfile(value, ctx);
  });

export async function createUserAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parsedInput = createUserSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false as const,
      message: parsedInput.error.issues[0]?.message ?? "Invalid user details.",
    };
  }

  if (!canCreateUser(actor.role, parsedInput.data.role)) {
    return {
      ok: false as const,
      message: "You do not have permission to create this account type.",
    };
  }

  return {
    ok: true as const,
    message: "User details validated.",
    temporaryPassword: parsedInput.data.password,
    user: parsedInput.data,
  };
}

export async function updateUserAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parsedInput = updateUserSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false as const,
      message: parsedInput.error.issues[0]?.message ?? "Invalid user details.",
    };
  }

  if (
    !canManageUser(actor.role, parsedInput.data.currentRole) ||
    !canManageUser(actor.role, parsedInput.data.role)
  ) {
    return {
      ok: false as const,
      message: "You do not have permission to edit this account.",
    };
  }

  return {
    ok: true as const,
    message: "User details validated.",
    user: parsedInput.data,
  };
}

const updateOwnAccountSchema = z.object({
  name: z.string().trim().min(1),
  phoneNumber: z.string().trim().min(5),
  address: z.string().trim().min(1),
  age: optionalAge,
});

const updateOwnPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z.string().min(8, "New password must be at least 8 characters."),
  })
  .superRefine((value, ctx) => {
    if (value.currentPassword === value.newPassword) {
      ctx.addIssue({
        code: "custom",
        message: "New password must be different from current password.",
        path: ["newPassword"],
      });
    }
  });

const bankAccountSchema = z.object({
  bankName: z.string().trim().min(1, "Bank name is required."),
  accountHolderName: z.string().trim().min(1, "Account holder name is required."),
  accountNumber: z.string().trim().min(6, "Account number must be at least 6 characters."),
  isCompanyAccount: z.boolean(),
  isPrimary: z.boolean(),
});

const updateOwnBankAccountSchema = bankAccountSchema.extend({
  id: z.string().min(1),
});

export async function updateOwnAccountAction(input: unknown) {
  await requireCurrentUser();
  const parsedInput = updateOwnAccountSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false as const,
      message: parsedInput.error.issues[0]?.message ?? "Invalid account details.",
    };
  }

  return {
    ok: true as const,
    message: "Account details validated.",
    user: parsedInput.data,
  };
}

export async function updateOwnPasswordAction(input: unknown) {
  await requireCurrentUser();
  const parsedInput = updateOwnPasswordSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false as const,
      message: parsedInput.error.issues[0]?.message ?? "Invalid password details.",
    };
  }

  return {
    ok: true as const,
    message: "Password details validated.",
  };
}

export async function createOwnBankAccountAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parsedInput = bankAccountSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false as const,
      message: parsedInput.error.issues[0]?.message ?? "Invalid bank account details.",
    };
  }

  return {
    ok: true as const,
    message: "Bank account details validated.",
    bankAccount: {
      id: crypto.randomUUID(),
      userId: actor.id,
      ...parsedInput.data,
    },
  };
}

export async function updateOwnBankAccountAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parsedInput = updateOwnBankAccountSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false as const,
      message: parsedInput.error.issues[0]?.message ?? "Invalid bank account details.",
    };
  }

  return {
    ok: true as const,
    message: "Bank account details validated.",
    bankAccount: {
      userId: actor.id,
      ...parsedInput.data,
    },
  };
}

export async function regeneratePasswordAction(targetRole: (typeof userRoles)[number]) {
  const actor = await requireCurrentUser();

  if (!canRegeneratePassword(actor.role, targetRole)) {
    throw new Error("You do not have permission to regenerate this password.");
  }

  return {
    temporaryPassword: generateTemporaryPassword(),
    mustResetPassword: true,
  };
}
