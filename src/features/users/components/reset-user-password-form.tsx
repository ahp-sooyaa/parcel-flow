"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { resetUserPasswordAction } from "@/features/users/server/actions";
import { cn } from "@/lib/utils";

type ResetUserPasswordFormProps = {
    userId: string;
};

const initialState = {
    ok: true,
    message: "",
    temporaryPassword: undefined,
};

export function ResetUserPasswordForm({ userId }: Readonly<ResetUserPasswordFormProps>) {
    const [state, action, isPending] = useActionState(resetUserPasswordAction, initialState);

    return (
        <form action={action} className="space-y-3">
            <input type="hidden" name="userId" value={userId} />
            <Button type="submit" variant="outline" disabled={isPending}>
                {isPending ? "Resetting..." : "Reset Password"}
            </Button>

            {state.message && (
                <div
                    className={cn("rounded-lg border p-3", {
                        "border-emerald-300 bg-emerald-50": state.ok,
                        "border-red-300 bg-red-50": !state.ok,
                    })}
                >
                    <p
                        className={cn("text-xs", {
                            "text-emerald-800": state.ok,
                            "text-destructive": !state.ok,
                        })}
                    >
                        {state.message}
                    </p>
                    {state.temporaryPassword && (
                        <p className="mt-2 text-xs font-semibold text-amber-900">
                            Temporary password (show once):{" "}
                            <span className="font-mono">{state.temporaryPassword}</span>
                        </p>
                    )}
                </div>
            )}
        </form>
    );
}
