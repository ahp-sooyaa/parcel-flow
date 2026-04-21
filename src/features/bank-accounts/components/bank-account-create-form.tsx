"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBankAccountAction } from "@/features/bank-accounts/server/actions";
import { cn } from "@/lib/utils";

type BankAccountCreateFormProps = {
    ownerType: "company" | "user";
    ownerAppUserId: string | null;
    basePath: string;
};

const initialState = {
    ok: true,
    message: "",
};

export function BankAccountCreateForm({
    ownerType,
    ownerAppUserId,
    basePath,
}: Readonly<BankAccountCreateFormProps>) {
    const [state, action, isPending] = useActionState(createBankAccountAction, initialState);
    const [values, setValues] = useState({
        bankName: "",
        bankAccountName: "",
        bankAccountNumber: "",
    });

    useEffect(() => {
        if (state.ok && state.message) {
            setValues({
                bankName: "",
                bankAccountName: "",
                bankAccountNumber: "",
            });
        }
    }, [state.ok, state.message]);

    return (
        <form action={action} className="space-y-4 rounded-xl border bg-muted/20 p-4">
            <input type="hidden" name="ownerType" value={ownerType} />
            <input type="hidden" name="ownerAppUserId" value={ownerAppUserId ?? ""} />
            <input type="hidden" name="basePath" value={basePath} />

            <div className="grid gap-2">
                <Label htmlFor="new-bank-name">Bank Name</Label>
                <Input
                    id="new-bank-name"
                    name="bankName"
                    value={values.bankName}
                    onChange={(event) =>
                        setValues((prev) => ({ ...prev, bankName: event.target.value }))
                    }
                    required
                />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="new-bank-account-name">Account Name</Label>
                <Input
                    id="new-bank-account-name"
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
                <Label htmlFor="new-bank-account-number">Account Number</Label>
                <Input
                    id="new-bank-account-number"
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

            <Button type="submit" disabled={isPending}>
                {isPending ? "Adding..." : "Add Bank Account"}
            </Button>
        </form>
    );
}
