"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import {
    createBankAccount,
    getBankAccountUserOwnerById,
    setPrimaryBankAccount,
    softDeleteBankAccount,
    updateBankAccount,
} from "./dal";
import {
    bankAccountIdActionSchema,
    createBankAccountSchema,
    getSafeBankAccountRevalidatePaths,
    isBankAccountUserOwnerRole,
    toBankAccountOwner,
    updateBankAccountSchema,
} from "./utils";
import { getBankAccountAccess } from "@/features/auth/server/policies/bank-accounts";
import { requireAppAccessContext } from "@/features/auth/server/utils";
import { logAuditEvent } from "@/lib/security/audit";

import type { BankAccountActionResult, BankAccountOwnerDto } from "./dto";

const forbiddenResult = {
    ok: false,
    message: "Forbidden",
} satisfies BankAccountActionResult;

async function resolveBankAccountOwner(input: {
    ownerType: "company" | "user";
    ownerAppUserId: string | null;
}) {
    const owner = toBankAccountOwner(input);

    if (!owner) {
        return { ok: false as const, message: "Bank account owner is required." };
    }

    if (owner.isCompanyAccount) {
        return { ok: true as const, owner };
    }

    const userOwner = await getBankAccountUserOwnerById(owner.appUserId ?? "");

    if (!userOwner || !isBankAccountUserOwnerRole(userOwner.roleSlug)) {
        return {
            ok: false as const,
            message: "Bank accounts are only supported for merchant and rider users.",
        };
    }

    return { ok: true as const, owner };
}

function revalidateBankAccountPaths(input: {
    owner: BankAccountOwnerDto;
    basePath?: string | null;
}) {
    for (const path of getSafeBankAccountRevalidatePaths(input)) {
        revalidatePath(path);
    }
}

export async function createBankAccountAction(
    _prevState: BankAccountActionResult,
    formData: FormData,
): Promise<BankAccountActionResult> {
    try {
        const currentUser = await requireAppAccessContext();
        const parsed = createBankAccountSchema.safeParse(Object.fromEntries(formData));

        if (!parsed.success) {
            return { ok: false, message: "Please provide valid bank account details." };
        }

        const ownerResult = await resolveBankAccountOwner(parsed.data);

        if (!ownerResult.ok) {
            return { ok: false, message: ownerResult.message };
        }

        const access = getBankAccountAccess({
            viewer: currentUser,
            owner: ownerResult.owner,
        });

        if (!access.canCreate) {
            return forbiddenResult;
        }

        const created = await createBankAccount({
            owner: ownerResult.owner,
            bankName: parsed.data.bankName,
            bankAccountName: parsed.data.bankAccountName,
            bankAccountNumber: parsed.data.bankAccountNumber,
        });

        await logAuditEvent({
            event: "bank_account.create",
            actorAppUserId: currentUser.appUserId,
            targetAppUserId: ownerResult.owner.appUserId ?? undefined,
            metadata: {
                bankAccountId: created.id,
                isCompanyAccount: ownerResult.owner.isCompanyAccount,
            },
        });

        revalidateBankAccountPaths({
            owner: ownerResult.owner,
            basePath: parsed.data.basePath,
        });

        return { ok: true, message: "Bank account added." };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to add bank account.";

        return { ok: false, message };
    }
}

export async function updateBankAccountAction(
    _prevState: BankAccountActionResult,
    formData: FormData,
): Promise<BankAccountActionResult> {
    try {
        const currentUser = await requireAppAccessContext();
        const parsed = updateBankAccountSchema.safeParse(Object.fromEntries(formData));

        if (!parsed.success) {
            return { ok: false, message: "Please provide valid bank account details." };
        }

        const ownerResult = await resolveBankAccountOwner(parsed.data);

        if (!ownerResult.ok) {
            return { ok: false, message: ownerResult.message };
        }

        const access = getBankAccountAccess({
            viewer: currentUser,
            owner: ownerResult.owner,
        });

        if (!access.canUpdate) {
            return forbiddenResult;
        }

        const updated = await updateBankAccount({
            owner: ownerResult.owner,
            bankAccountId: parsed.data.bankAccountId,
            bankName: parsed.data.bankName,
            bankAccountName: parsed.data.bankAccountName,
            bankAccountNumber: parsed.data.bankAccountNumber,
        });

        if (!updated) {
            return { ok: false, message: "Bank account was not found." };
        }

        await logAuditEvent({
            event: "bank_account.update",
            actorAppUserId: currentUser.appUserId,
            targetAppUserId: ownerResult.owner.appUserId ?? undefined,
            metadata: {
                bankAccountId: parsed.data.bankAccountId,
                isCompanyAccount: ownerResult.owner.isCompanyAccount,
            },
        });

        revalidateBankAccountPaths({
            owner: ownerResult.owner,
            basePath: parsed.data.basePath,
        });

        return { ok: true, message: "Bank account updated." };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to update bank account.";

        return { ok: false, message };
    }
}

export async function setPrimaryBankAccountAction(
    _prevState: BankAccountActionResult,
    formData: FormData,
): Promise<BankAccountActionResult> {
    try {
        const currentUser = await requireAppAccessContext();
        const parsed = bankAccountIdActionSchema.safeParse(Object.fromEntries(formData));

        if (!parsed.success) {
            return { ok: false, message: "Bank account id is required." };
        }

        const ownerResult = await resolveBankAccountOwner(parsed.data);

        if (!ownerResult.ok) {
            return { ok: false, message: ownerResult.message };
        }

        const access = getBankAccountAccess({
            viewer: currentUser,
            owner: ownerResult.owner,
        });

        if (!access.canUpdate) {
            return forbiddenResult;
        }

        const updated = await setPrimaryBankAccount({
            owner: ownerResult.owner,
            bankAccountId: parsed.data.bankAccountId,
        });

        if (!updated) {
            return { ok: false, message: "Bank account was not found." };
        }

        await logAuditEvent({
            event: "bank_account.set_primary",
            actorAppUserId: currentUser.appUserId,
            targetAppUserId: ownerResult.owner.appUserId ?? undefined,
            metadata: {
                bankAccountId: parsed.data.bankAccountId,
                isCompanyAccount: ownerResult.owner.isCompanyAccount,
            },
        });

        revalidateBankAccountPaths({
            owner: ownerResult.owner,
            basePath: parsed.data.basePath,
        });

        return { ok: true, message: "Primary bank account updated." };
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to update primary bank account.";

        return { ok: false, message };
    }
}

export async function deleteBankAccountAction(
    _prevState: BankAccountActionResult,
    formData: FormData,
): Promise<BankAccountActionResult> {
    try {
        const currentUser = await requireAppAccessContext();
        const parsed = bankAccountIdActionSchema.safeParse(Object.fromEntries(formData));

        if (!parsed.success) {
            return { ok: false, message: "Bank account id is required." };
        }

        const ownerResult = await resolveBankAccountOwner(parsed.data);

        if (!ownerResult.ok) {
            return { ok: false, message: ownerResult.message };
        }

        const access = getBankAccountAccess({
            viewer: currentUser,
            owner: ownerResult.owner,
        });

        if (!access.canDelete) {
            return forbiddenResult;
        }

        const deleted = await softDeleteBankAccount({
            owner: ownerResult.owner,
            bankAccountId: parsed.data.bankAccountId,
        });

        if (!deleted) {
            return { ok: false, message: "Bank account was not found." };
        }

        await logAuditEvent({
            event: "bank_account.delete",
            actorAppUserId: currentUser.appUserId,
            targetAppUserId: ownerResult.owner.appUserId ?? undefined,
            metadata: {
                bankAccountId: parsed.data.bankAccountId,
                isCompanyAccount: ownerResult.owner.isCompanyAccount,
                softDeleted: true,
            },
        });

        revalidateBankAccountPaths({
            owner: ownerResult.owner,
            basePath: parsed.data.basePath,
        });

        return { ok: true, message: "Bank account deleted." };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to delete bank account.";

        return { ok: false, message };
    }
}
