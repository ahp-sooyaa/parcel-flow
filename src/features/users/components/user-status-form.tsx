"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { updateUserStatusFormAction } from "@/features/users/server/actions";
import { cn } from "@/lib/utils";

type UserStatusFormProps = {
    userId: string;
    initialIsActive: boolean;
};

const initialState = {
    ok: true,
    message: "",
    isActive: undefined,
};

export function UserStatusForm({ userId, initialIsActive }: Readonly<UserStatusFormProps>) {
    const [state, action, isPending] = useActionState(updateUserStatusFormAction, initialState);
    const [isActive, setIsActive] = useState(initialIsActive);

    useEffect(() => {
        if (typeof state.isActive === "boolean") {
            setIsActive(state.isActive);
        }
    }, [state.isActive]);

    return (
        <div className="space-y-4">
            <header className="mb-1 flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold">User Status</h2>
                <span
                    className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                        isActive
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-200 text-slate-700",
                    )}
                >
                    {isActive ? "Active" : "Inactive"}
                </span>
            </header>

            <p className="text-xs text-muted-foreground">
                Turn account access on or off for this user. Deactivation blocks sign-in until the
                account is reactivated.
            </p>

            <form
                action={action}
                className="space-y-4"
                onSubmit={(event) => {
                    if (
                        isActive &&
                        !globalThis.confirm(
                            "Deactivate this account? The user will not be able to sign in until it is activated again.",
                        )
                    ) {
                        event.preventDefault();
                    }
                }}
            >
                <input type="hidden" name="userId" value={userId} />
                <input type="hidden" name="isActive" value={isActive ? "false" : "true"} />

                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
                    <div className="space-y-1">
                        <p className="text-sm font-medium">Account Access</p>
                        <p className="text-xs text-muted-foreground">
                            {isActive
                                ? "The user can currently access the account."
                                : "The user is blocked from accessing the account."}
                        </p>
                    </div>

                    <Button
                        type="submit"
                        variant="ghost"
                        role="switch"
                        aria-checked={isActive}
                        aria-label={isActive ? "Deactivate account" : "Activate account"}
                        disabled={isPending}
                        className="h-auto rounded-full px-0 py-0 hover:bg-transparent"
                    >
                        <span
                            className={cn(
                                "relative h-7 w-12 rounded-full transition-colors",
                                isActive ? "bg-emerald-600" : "bg-slate-300",
                            )}
                        >
                            <span
                                className={cn(
                                    "absolute top-1 left-1 size-5 rounded-full bg-white shadow-sm transition-transform",
                                    isActive && "translate-x-5",
                                )}
                            />
                        </span>
                    </Button>
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
            </form>
        </div>
    );
}
