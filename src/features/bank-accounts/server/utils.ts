import "server-only";
import { z } from "zod";
import { optionalNullableTrimmedString, optionalNullableUuid } from "@/lib/validation/zod-helpers";

import type { BankAccountOwnerDto } from "./dto";
import type { RoleSlug } from "@/db/constants";

const ownerTypeSchema = z.enum(["company", "user"]);

const bankAccountFieldsSchema = z.object({
    bankName: z.string().trim().min(1).max(120),
    bankAccountName: z.string().trim().min(1).max(120),
    bankAccountNumber: z.string().trim().min(1).max(80),
});

const ownerSchema = z.object({
    ownerType: ownerTypeSchema,
    ownerAppUserId: optionalNullableUuid(),
    basePath: optionalNullableTrimmedString(220),
});

export const createBankAccountSchema = ownerSchema.merge(bankAccountFieldsSchema);

export const updateBankAccountSchema = ownerSchema.merge(bankAccountFieldsSchema).extend({
    bankAccountId: z.string().trim().uuid(),
});

export const bankAccountIdActionSchema = ownerSchema.extend({
    bankAccountId: z.string().trim().uuid(),
});

export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>;
export type BankAccountIdActionInput = z.infer<typeof bankAccountIdActionSchema>;

export function toBankAccountOwner(input: {
    ownerType: "company" | "user";
    ownerAppUserId: string | null;
}): BankAccountOwnerDto | null {
    if (input.ownerType === "company") {
        return {
            appUserId: null,
            isCompanyAccount: true,
        };
    }

    if (!input.ownerAppUserId) {
        return null;
    }

    return {
        appUserId: input.ownerAppUserId,
        isCompanyAccount: false,
    };
}

export function isBankAccountUserOwnerRole(roleSlug: RoleSlug) {
    return roleSlug === "merchant" || roleSlug === "rider";
}

export function getOwnerDisplayLabel(input: { roleSlug: RoleSlug; fullName: string }) {
    if (input.roleSlug === "super_admin") {
        return "Company Bank Accounts";
    }

    return `${input.fullName} Bank Accounts`;
}

export function getSafeBankAccountRevalidatePaths(input: {
    owner: BankAccountOwnerDto;
    basePath?: string | null;
}) {
    const paths = new Set<string>(["/dashboard/settings"]);

    if (input.owner.appUserId) {
        paths.add(`/dashboard/users/${input.owner.appUserId}`);
        paths.add(`/dashboard/users/${input.owner.appUserId}/edit`);
        paths.add(`/dashboard/merchants/${input.owner.appUserId}`);
        paths.add(`/dashboard/riders/${input.owner.appUserId}`);
    }

    const basePath = input.basePath ?? "";

    if (
        basePath === "/dashboard/settings" ||
        /^\/dashboard\/users\/[0-9a-f-]{36}\/edit$/i.test(basePath)
    ) {
        paths.add(basePath);
    }

    return Array.from(paths);
}
