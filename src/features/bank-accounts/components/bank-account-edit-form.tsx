"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateBankAccountAction } from "@/features/bank-accounts/server/actions";
import { cn } from "@/lib/utils";

type BankAccountEditFormProps = {
    account: {
        id: string;
        bankName: string;
        bankAccountName: string;
        bankAccountNumber: string;
        isPrimary: boolean;
    };
    ownerType: "company" | "user";
    ownerAppUserId: string | null;
    basePath: string;
};

const initialState = {
    ok: true,
    message: "",
};

export function BankAccountEditForm({
    account,
    ownerType,
    ownerAppUserId,
    basePath,
}: Readonly<BankAccountEditFormProps>) {
    const [state, action, isPending] = useActionState(updateBankAccountAction, initialState);
    const [values, setValues] = useState({
        bankName: account.bankName,
        bankAccountName: account.bankAccountName,
        bankAccountNumber: account.bankAccountNumber,
    });

    useEffect(() => {
        setValues({
            bankName: account.bankName,
            bankAccountName: account.bankAccountName,
            bankAccountNumber: account.bankAccountNumber,
        });
    }, [account]);

    return (
        <form action={action} className="space-y-4">
            <input type="hidden" name="bankAccountId" value={account.id} />
            <input type="hidden" name="ownerType" value={ownerType} />
            <input type="hidden" name="ownerAppUserId" value={ownerAppUserId ?? ""} />
            <input type="hidden" name="basePath" value={basePath} />

            <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold">{account.bankName}</h3>
                {account.isPrimary && (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        Primary
                    </span>
                )}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                    <Label htmlFor={`bank-name-${account.id}`}>Bank Name</Label>
                    <Input
                        id={`bank-name-${account.id}`}
                        name="bankName"
                        value={values.bankName}
                        onChange={(event) =>
                            setValues((prev) => ({ ...prev, bankName: event.target.value }))
                        }
                        required
                    />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor={`bank-account-name-${account.id}`}>Account Name</Label>
                    <Input
                        id={`bank-account-name-${account.id}`}
                        name="bankAccountName"
                        value={values.bankAccountName}
                        onChange={(event) =>
                            setValues((prev) => ({
                                ...prev,
                                bankAccountName: event.target.value,
                            }))
                        }
                        required
                    />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor={`bank-account-number-${account.id}`}>Account Number</Label>
                    <Input
                        id={`bank-account-number-${account.id}`}
                        name="bankAccountNumber"
                        value={values.bankAccountNumber}
                        onChange={(event) =>
                            setValues((prev) => ({
                                ...prev,
                                bankAccountNumber: event.target.value,
                            }))
                        }
                        required
                    />
                </div>
            </div>

            {state.message && (
                <p
                    className={cn("text-xs", {
                        "text-emerald-700": state.ok,
                        "text-destructive": !state.ok,
                    })}
                >
                    {state.message}
                </p>
            )}

            <Button type="submit" disabled={isPending} variant="outline">
                {isPending ? "Saving..." : "Save Bank Account"}
            </Button>
        </form>
    );
}
