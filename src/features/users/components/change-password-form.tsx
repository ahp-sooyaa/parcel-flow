"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeOwnPasswordAction } from "@/features/users/server/actions";
import { cn } from "@/lib/utils";

const initialState = {
    ok: true,
    message: "",
};

export function ChangePasswordForm() {
    const [state, action, isPending] = useActionState(changeOwnPasswordAction, initialState);

    return (
        <form action={action} className="space-y-4">
            <div className="grid gap-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input id="new-password" name="password" type="password" required minLength={12} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                    id="confirm-password"
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={12}
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
                {isPending ? "Updating..." : "Change Password"}
            </Button>
        </form>
    );
}
