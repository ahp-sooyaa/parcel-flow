"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { softDeleteUserAction } from "@/features/users/server/actions";
import { cn } from "@/lib/utils";

type SoftDeleteUserFormProps = {
  userId: string;
};

const initialState = {
  ok: true,
  message: "",
};

export function SoftDeleteUserForm({ userId }: Readonly<SoftDeleteUserFormProps>) {
  const [state, action, isPending] = useActionState(softDeleteUserAction, initialState);

  return (
    <form
      action={action}
      className="space-y-4"
      onSubmit={(event) => {
        if (
          !globalThis.confirm(
            "Delete this user? The user will be removed from normal screens, but the record will be kept for history and audit purposes.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="userId" value={userId} />

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

      <Button type="submit" variant="destructive" disabled={isPending}>
        {isPending ? "Deleting..." : "Delete User"}
      </Button>
    </form>
  );
}
