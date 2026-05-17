"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type LoginFormState } from "@/features/auth/server/login";

export function LoginForm() {
  const initialState: LoginFormState = {
    username: "",
    message: null,
  };
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <Card className="w-full max-w-md border-[#3f3a52] bg-white text-foreground shadow-2xl">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Use the username and password provided by your admin.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              defaultValue={state.username}
              placeholder="daw-hnin"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" />
          </div>
          {state.message ? <p className="text-sm text-destructive">{state.message}</p> : null}
          <Button className="w-full" type="submit" disabled={isPending}>
            {isPending ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
