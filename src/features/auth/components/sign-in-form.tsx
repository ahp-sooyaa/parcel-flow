"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction } from "@/features/auth/server/actions";

const initialState = {
  ok: true,
  message: "",
};

export function SignInForm() {
  const [state, formAction, isPending] = useActionState(signInAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="name@company.com" required />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required />
      </div>

      {state.message && (
        <p className={state.ok ? "text-xs text-emerald-700" : "text-xs text-destructive"}>
          {state.message}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Forgot password is handled by admin-assisted reset in this release.
      </p>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Signing In..." : "Sign In"}
      </Button>
    </form>
  );
}
