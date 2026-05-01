"use client";

import { useActionState, useEffect, useState } from "react";
import { FormFieldError } from "@/components/shared/form-field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { createTownshipAction } from "@/features/townships/server/actions";
import { cn } from "@/lib/utils";

const initialState = {
    ok: true,
    message: "",
    townshipId: undefined,
    fieldErrors: undefined,
};

export function CreateTownshipSheet() {
    const [open, setOpen] = useState(false);
    const [state, action, isPending] = useActionState(createTownshipAction, initialState);

    useEffect(() => {
        if (state.ok && state.townshipId) {
            setOpen(false);
        }
    }, [state.ok, state.townshipId]);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button size="sm">Create Township</Button>
            </SheetTrigger>

            <SheetContent
                side="bottom"
                className="max-h-[85vh] rounded-t-2xl border-x-0 border-b-0"
            >
                <form action={action} className="flex h-full flex-col gap-0">
                    <SheetHeader className="pr-8">
                        <SheetTitle>Create Township</SheetTitle>
                        <SheetDescription>
                            Add township master data used by merchant and rider workflows.
                        </SheetDescription>
                    </SheetHeader>

                    <div className="flex-1 space-y-5 overflow-y-auto py-6">
                        <div className="grid gap-2">
                            <Label htmlFor="create-township-name">Township Name</Label>
                            <Input
                                id="create-township-name"
                                name="name"
                                placeholder="Enter township name"
                                required
                                aria-invalid={Boolean(state.fieldErrors?.name?.[0])}
                            />
                            <FormFieldError message={state.fieldErrors?.name?.[0]} />
                        </div>

                        <label
                            htmlFor="create-township-is-active"
                            className="flex items-center gap-2 text-sm"
                        >
                            <input
                                id="create-township-is-active"
                                type="checkbox"
                                name="isActive"
                                defaultChecked
                                className="h-4 w-4"
                            />
                            Township is active
                        </label>

                        {state.message ? (
                            <p
                                className={cn("text-xs", {
                                    "text-emerald-700": state.ok,
                                    "text-destructive": !state.ok,
                                })}
                            >
                                {state.message}
                            </p>
                        ) : null}
                    </div>

                    <SheetFooter className="mt-auto border-t pt-4">
                        <Button type="submit" disabled={isPending}>
                            {isPending ? "Creating..." : "Create Township"}
                        </Button>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    );
}
