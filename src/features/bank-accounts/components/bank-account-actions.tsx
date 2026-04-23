"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
    deleteBankAccountAction,
    setPrimaryBankAccountAction,
} from "@/features/bank-accounts/server/actions";
import { cn } from "@/lib/utils";

type BankAccountActionFormsProps = {
    account: {
        id: string;
        isPrimary: boolean;
    };
    ownerType: "company" | "user";
    ownerAppUserId: string | null;
    basePath: string;
    permissions: {
        canUpdate: boolean;
        canDelete: boolean;
    };
};

const initialState = {
    ok: true,
    message: "",
};

export function BankAccountActionForms({
    account,
    ownerType,
    ownerAppUserId,
    basePath,
    permissions,
}: Readonly<BankAccountActionFormsProps>) {
    const [primaryState, primaryAction, isPrimaryPending] = useActionState(
        setPrimaryBankAccountAction,
        initialState,
    );
    const [deleteState, deleteAction, isDeletePending] = useActionState(
        deleteBankAccountAction,
        initialState,
    );
    const actionMessage = deleteState.message || primaryState.message;
    const actionOk = deleteState.message ? deleteState.ok : primaryState.ok;

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
                {permissions.canUpdate && !account.isPrimary && (
                    <form action={primaryAction}>
                        <input type="hidden" name="bankAccountId" value={account.id} />
                        <input type="hidden" name="ownerType" value={ownerType} />
                        <input type="hidden" name="ownerAppUserId" value={ownerAppUserId ?? ""} />
                        <input type="hidden" name="basePath" value={basePath} />
                        <Button type="submit" disabled={isPrimaryPending} variant="outline">
                            {isPrimaryPending ? "Updating..." : "Set Primary"}
                        </Button>
                    </form>
                )}

                {permissions.canDelete && (
                    <form
                        action={deleteAction}
                        onSubmit={(event) => {
                            if (!globalThis.confirm("Delete this bank account?")) {
                                event.preventDefault();
                            }
                        }}
                    >
                        <input type="hidden" name="bankAccountId" value={account.id} />
                        <input type="hidden" name="ownerType" value={ownerType} />
                        <input type="hidden" name="ownerAppUserId" value={ownerAppUserId ?? ""} />
                        <input type="hidden" name="basePath" value={basePath} />
                        <Button type="submit" disabled={isDeletePending} variant="outline">
                            {isDeletePending ? "Deleting..." : "Delete"}
                        </Button>
                    </form>
                )}
            </div>

            {actionMessage && (
                <p
                    className={cn("text-xs", {
                        "text-emerald-700": actionOk,
                        "text-destructive": !actionOk,
                    })}
                >
                    {actionMessage}
                </p>
            )}
        </div>
    );
}
