import { z } from "zod";

import { creatableUserRoles, userRoles, type UserRole } from "@/lib/domain";
import { maxLengthMessage, TEXT_LIMITS } from "@/lib/validation";

const optionalTrimmedString = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length === 0 ? undefined : trimmedValue;
}, z.string().min(1).max(TEXT_LIMITS.shopName).optional());

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
  name: z.string().trim().min(1).max(TEXT_LIMITS.name, maxLengthMessage("Name", TEXT_LIMITS.name)),
  phoneNumber: z
    .string()
    .trim()
    .min(5)
    .max(TEXT_LIMITS.phoneNumber, maxLengthMessage("Phone number", TEXT_LIMITS.phoneNumber)),
  address: z
    .string()
    .trim()
    .min(1)
    .max(TEXT_LIMITS.address, maxLengthMessage("Address", TEXT_LIMITS.address)),
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
    password: z
      .string()
      .min(8)
      .max(TEXT_LIMITS.password, maxLengthMessage("Password", TEXT_LIMITS.password)),
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
  name: z.string().trim().min(1).max(TEXT_LIMITS.name, maxLengthMessage("Name", TEXT_LIMITS.name)),
  phoneNumber: z
    .string()
    .trim()
    .min(5)
    .max(TEXT_LIMITS.phoneNumber, maxLengthMessage("Phone number", TEXT_LIMITS.phoneNumber)),
  address: z
    .string()
    .trim()
    .min(1)
    .max(TEXT_LIMITS.address, maxLengthMessage("Address", TEXT_LIMITS.address)),
  age: optionalAge,
});

export const bankAccountInputSchema = z.object({
  bankName: z
    .string()
    .trim()
    .min(1, "Bank name is required.")
    .max(TEXT_LIMITS.bankName, maxLengthMessage("Bank name", TEXT_LIMITS.bankName)),
  accountHolderName: z
    .string()
    .trim()
    .min(1, "Account holder name is required.")
    .max(TEXT_LIMITS.name, maxLengthMessage("Account holder name", TEXT_LIMITS.name)),
  accountNumber: z
    .string()
    .trim()
    .min(6, "Account number must be at least 6 characters.")
    .max(TEXT_LIMITS.accountNumber, maxLengthMessage("Account number", TEXT_LIMITS.accountNumber)),
  isCompanyAccount: z.boolean(),
  isPrimary: z.boolean(),
});

export const updateOwnBankAccountInputSchema = bankAccountInputSchema.extend({
  id: z.string().min(1),
});

export const createUserBankAccountInputSchema = bankAccountInputSchema.extend({
  userId: z.string().min(1),
});

export const updateUserBankAccountInputSchema = bankAccountInputSchema.extend({
  id: z.string().min(1),
  userId: z.string().min(1),
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

const userListSearchParamsSchema = z.object({
  query: z.string().trim().max(100).optional().catch(""),
  page: z.coerce.number().int().min(1).optional().catch(1),
});

export type UserListFiltersDto = {
  searchTerm: string;
  page: number;
  pageSize: number;
};

export type UserListPageDto = {
  users: UserListItemDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export const userListPageSize = 20;

export function parseUserListFilters(
  input: Record<string, string | string[] | undefined>,
): UserListFiltersDto {
  const parseResult = userListSearchParamsSchema.safeParse({
    query: readSearchParam(input.query),
    page: readSearchParam(input.page),
  });

  if (!parseResult.success) {
    return {
      searchTerm: "",
      page: 1,
      pageSize: userListPageSize,
    };
  }

  return {
    searchTerm: parseResult.data.query ?? "",
    page: parseResult.data.page ?? 1,
    pageSize: userListPageSize,
  };
}

function readSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export type BankAccountDto = {
  id: string;
  userId: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  isCompanyAccount: boolean;
  isPrimary: boolean;
};
