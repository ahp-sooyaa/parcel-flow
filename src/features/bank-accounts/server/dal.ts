import "server-only";
import { and, asc, desc, eq, isNull, ne, sql, type SQL } from "drizzle-orm";
import { toBankAccountDto, type BankAccountDto, type BankAccountOwnerDto } from "./dto";
import { db } from "@/db";
import { appUsers, bankAccounts, roles } from "@/db/schema";
import { getBankAccountAccess } from "@/features/auth/server/policies/bank-accounts";

import type { RoleSlug } from "@/db/constants";
import type { AppAccessViewer } from "@/features/auth/server/dto";

function ownerConditions(owner: BankAccountOwnerDto): SQL[] {
    if (owner.isCompanyAccount) {
        return [eq(bankAccounts.isCompanyAccount, true), isNull(bankAccounts.appUserId)];
    }

    if (!owner.appUserId) {
        return [sql`false`];
    }

    return [eq(bankAccounts.isCompanyAccount, false), eq(bankAccounts.appUserId, owner.appUserId)];
}

export async function getBankAccountUserOwnerById(appUserId: string): Promise<{
    id: string;
    roleSlug: RoleSlug;
} | null> {
    const [row] = await db
        .select({
            id: appUsers.id,
            roleSlug: roles.slug,
        })
        .from(appUsers)
        .innerJoin(roles, eq(appUsers.roleId, roles.id))
        .where(and(eq(appUsers.id, appUserId), isNull(appUsers.deletedAt)))
        .limit(1);

    return row ?? null;
}

export async function getBankAccountsForViewer(
    viewer: AppAccessViewer,
    owner: BankAccountOwnerDto,
): Promise<BankAccountDto[]> {
    const access = getBankAccountAccess({ viewer, owner });

    if (!access.canView) {
        return [];
    }

    const rows = await db
        .select({
            id: bankAccounts.id,
            appUserId: bankAccounts.appUserId,
            bankName: bankAccounts.bankName,
            bankAccountName: bankAccounts.bankAccountName,
            bankAccountNumber: bankAccounts.bankAccountNumber,
            isCompanyAccount: bankAccounts.isCompanyAccount,
            isPrimary: bankAccounts.isPrimary,
            createdAt: bankAccounts.createdAt,
            updatedAt: bankAccounts.updatedAt,
        })
        .from(bankAccounts)
        .where(and(...ownerConditions(owner), isNull(bankAccounts.deletedAt)))
        .orderBy(
            desc(bankAccounts.isPrimary),
            asc(bankAccounts.bankName),
            desc(bankAccounts.updatedAt),
        );

    return rows.map((row) => toBankAccountDto(row));
}

export async function createBankAccount(input: {
    owner: BankAccountOwnerDto;
    bankName: string;
    bankAccountName: string;
    bankAccountNumber: string;
}) {
    return db.transaction(async (tx) => {
        const [existingAccount] = await tx
            .select({ id: bankAccounts.id })
            .from(bankAccounts)
            .where(and(...ownerConditions(input.owner), isNull(bankAccounts.deletedAt)))
            .limit(1);

        const [created] = await tx
            .insert(bankAccounts)
            .values({
                appUserId: input.owner.appUserId,
                bankName: input.bankName,
                bankAccountName: input.bankAccountName,
                bankAccountNumber: input.bankAccountNumber,
                isCompanyAccount: input.owner.isCompanyAccount,
                isPrimary: !existingAccount,
            })
            .returning({ id: bankAccounts.id });

        return created;
    });
}

export async function updateBankAccount(input: {
    owner: BankAccountOwnerDto;
    bankAccountId: string;
    bankName: string;
    bankAccountName: string;
    bankAccountNumber: string;
}) {
    const [updated] = await db
        .update(bankAccounts)
        .set({
            bankName: input.bankName,
            bankAccountName: input.bankAccountName,
            bankAccountNumber: input.bankAccountNumber,
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(bankAccounts.id, input.bankAccountId),
                ...ownerConditions(input.owner),
                isNull(bankAccounts.deletedAt),
            ),
        )
        .returning({ id: bankAccounts.id });

    return Boolean(updated);
}

export async function setPrimaryBankAccount(input: {
    owner: BankAccountOwnerDto;
    bankAccountId: string;
}) {
    return db.transaction(async (tx) => {
        const [targetAccount] = await tx
            .select({ id: bankAccounts.id })
            .from(bankAccounts)
            .where(
                and(
                    eq(bankAccounts.id, input.bankAccountId),
                    ...ownerConditions(input.owner),
                    isNull(bankAccounts.deletedAt),
                ),
            )
            .limit(1);

        if (!targetAccount) {
            return false;
        }

        const updatedAt = new Date();

        await tx
            .update(bankAccounts)
            .set({ isPrimary: false, updatedAt })
            .where(
                and(
                    ...ownerConditions(input.owner),
                    eq(bankAccounts.isPrimary, true),
                    ne(bankAccounts.id, input.bankAccountId),
                    isNull(bankAccounts.deletedAt),
                ),
            );

        await tx
            .update(bankAccounts)
            .set({ isPrimary: true, updatedAt })
            .where(
                and(
                    eq(bankAccounts.id, input.bankAccountId),
                    ...ownerConditions(input.owner),
                    isNull(bankAccounts.deletedAt),
                ),
            );

        return true;
    });
}

export async function softDeleteBankAccount(input: {
    owner: BankAccountOwnerDto;
    bankAccountId: string;
}) {
    return db.transaction(async (tx) => {
        const deletedAt = new Date();
        const [deleted] = await tx
            .update(bankAccounts)
            .set({
                deletedAt,
                updatedAt: deletedAt,
            })
            .where(
                and(
                    eq(bankAccounts.id, input.bankAccountId),
                    ...ownerConditions(input.owner),
                    isNull(bankAccounts.deletedAt),
                ),
            )
            .returning({
                id: bankAccounts.id,
                wasPrimary: bankAccounts.isPrimary,
            });

        if (!deleted) {
            return false;
        }

        if (!deleted.wasPrimary) {
            return true;
        }

        const [replacement] = await tx
            .select({ id: bankAccounts.id })
            .from(bankAccounts)
            .where(
                and(
                    ...ownerConditions(input.owner),
                    ne(bankAccounts.id, deleted.id),
                    isNull(bankAccounts.deletedAt),
                ),
            )
            .orderBy(desc(bankAccounts.updatedAt), desc(bankAccounts.createdAt))
            .limit(1);

        if (replacement) {
            await tx
                .update(bankAccounts)
                .set({
                    isPrimary: true,
                    updatedAt: deletedAt,
                })
                .where(eq(bankAccounts.id, replacement.id));
        }

        return true;
    });
}
