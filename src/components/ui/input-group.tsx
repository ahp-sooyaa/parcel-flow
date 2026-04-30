"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type InputGroupAddonAlign = "inline-start" | "inline-end";

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="input-group"
            className={cn(
                "flex min-w-0 items-stretch overflow-hidden rounded-lg border border-input bg-background transition-colors outline-none focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
                className,
            )}
            {...props}
        />
    );
}

function InputGroupInput({ className, ...props }: React.ComponentProps<typeof Input>) {
    return (
        <Input
            data-slot="input-group-control"
            className={cn(
                "h-full flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:border-transparent focus-visible:ring-0 disabled:bg-transparent dark:bg-transparent dark:disabled:bg-transparent",
                className,
            )}
            {...props}
        />
    );
}

function InputGroupAddon({
    className,
    align = "inline-start",
    ...props
}: React.ComponentProps<"div"> & {
    align?: InputGroupAddonAlign;
}) {
    return (
        <div
            data-slot="input-group-addon"
            data-align={align}
            className={cn(
                "flex shrink-0 items-center px-2.5 text-muted-foreground",
                {
                    "order-first border-r border-border": align === "inline-start",
                    "order-last border-l border-border": align === "inline-end",
                },
                className,
            )}
            {...props}
        />
    );
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
    return (
        <span
            data-slot="input-group-text"
            className={cn("text-sm font-medium", className)}
            {...props}
        />
    );
}

export { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText };
