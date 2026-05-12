import { z } from "zod";

import { creatableUserRoles, userRoles, type UserRole } from "@/lib/domain";

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

const userProfileInputSchema = z.object({
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

export const createUserInputSchema = userProfileInputSchema
  .extend({
    role: z.enum(creatableUserRoles),
    password: z.string().min(8),
  })
  .superRefine((value, ctx) => {
    validateRoleSpecificProfile(value, ctx);
  });

export const updateUserInputSchema = userProfileInputSchema
  .extend({
    id: z.string().min(1),
    role: z.enum(userRoles),
  })
  .superRefine((value, ctx) => {
    validateRoleSpecificProfile(value, ctx);
  });

export const updateOwnAccountInputSchema = z.object({
  name: z.string().trim().min(1),
  phoneNumber: z.string().trim().min(5),
  address: z.string().trim().min(1),
  age: optionalAge,
});

export const bankAccountInputSchema = z.object({
  bankName: z.string().trim().min(1, "Bank name is required."),
  accountHolderName: z.string().trim().min(1, "Account holder name is required."),
  accountNumber: z.string().trim().min(6, "Account number must be at least 6 characters."),
  isCompanyAccount: z.boolean(),
  isPrimary: z.boolean(),
});

export const updateOwnBankAccountInputSchema = bankAccountInputSchema.extend({
  id: z.string().min(1),
});

export type UserListItemDto = {
  id: string;
  name: string;
  phoneNumber: string;
  address: string;
  age: number | null;
  role: UserRole;
  shopName: string | null;
  serviceTownshipId: string | null;
  serviceTownshipName: string | null;
  isActive: boolean;
  mustResetPassword: boolean;
};

export type BankAccountDto = {
  id: string;
  userId: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  isCompanyAccount: boolean;
  isPrimary: boolean;
};
