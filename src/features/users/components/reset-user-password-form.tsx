"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { resetUserPasswordAction } from "@/features/users/server/actions";
import { cn } from "@/lib/utils";

type ResetUserPasswordFormProps = {
    userId: string;
    initialMustResetPassword: boolean;
};

const initialState = {
    ok: true,
    message: "",
    temporaryPassword: undefined,
};

export function ResetUserPasswordForm({
    userId,
    initialMustResetPassword,
}: Readonly<ResetUserPasswordFormProps>) {
    const [state, action, isPending] = useActionState(resetUserPasswordAction, initialState);
    const [mustResetPassword, setMustResetPassword] = useState(initialMustResetPassword);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (state.ok && state.temporaryPassword) {
            setMustResetPassword(true);
            setCopied(false);
        }
    }, [state.ok, state.temporaryPassword]);

    return (
        <form action={action} className="space-y-4">
            <input type="hidden" name="userId" value={userId} />

            <div className="grid gap-1 text-sm">
                <p className="text-xs text-muted-foreground">User Login State</p>
                <p>{mustResetPassword ? "Must Change Password on Login" : "Normal Sign-In"}</p>
            </div>

            <Button type="submit" variant="outline" disabled={isPending}>
                {isPending ? "Generating..." : "Generate Temporary Password"}
            </Button>

            {state.message && state.temporaryPassword && (
                <div
                    className={cn("mt-3 space-y-3 rounded-lg border p-3", {
                        "border-emerald-300 bg-emerald-50": state.ok,
                        "border-red-300 bg-red-50": !state.ok,
                    })}
                >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                            <p className="text-xs font-medium tracking-wide text-amber-900 uppercase">
                                {state.message}
                            </p>
                            <p className="font-mono text-sm font-semibold text-amber-950">
                                {state.temporaryPassword}
                            </p>
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                                await navigator.clipboard.writeText(state.temporaryPassword ?? "");
                                setCopied(true);
                            }}
                        >
                            {copied ? "Copied" : "Copy to Clipboard"}
                        </Button>
                    </div>

                    <p className="text-xs text-amber-950">
                        This temporary password will expire once the user sets their own.
                    </p>
                </div>
            )}
        </form>
    );
}
