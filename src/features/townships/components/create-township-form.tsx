"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTownshipAction } from "@/features/townships/server/actions";

const initialState = {
  ok: true,
  message: "",
  townshipId: undefined,
};

export function CreateTownshipForm() {
  const [state, action, isPending] = useActionState(createTownshipAction, initialState);

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-2">
        <Label htmlFor="township-name">Township Name</Label>
        <Input id="township-name" name="name" placeholder="Enter township name" required />
      </div>

      <label htmlFor="township-is-active" className="flex items-center gap-2 text-sm">
        <input
          id="township-is-active"
          type="checkbox"
          name="isActive"
          defaultChecked
          className="h-4 w-4"
        />{" "}
        Township is active
      </label>

      {state.message && (
        <div
          className={
            state.ok
              ? "rounded-lg border border-emerald-300 bg-emerald-50 p-3"
              : "rounded-lg border border-red-300 bg-red-50 p-3"
          }
        >
          <p className={state.ok ? "text-xs text-emerald-800" : "text-xs text-destructive"}>
            {state.message}
          </p>
        </div>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create Township"}
      </Button>
    </form>
  );
}
