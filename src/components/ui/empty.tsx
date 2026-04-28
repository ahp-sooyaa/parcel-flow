"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function Empty({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="empty"
            className={cn(
                "flex flex-col items-center justify-center gap-5 rounded-xl px-6 py-8 text-center",
                className,
            )}
            {...props}
        />
    );
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="empty-header"
            className={cn("flex max-w-sm flex-col items-center gap-2", className)}
            {...props}
        />
    );
}

function EmptyMedia({
    className,
    variant = "default",
    ...props
}: React.ComponentProps<"div"> & {
    variant?: "default" | "icon";
}) {
    return (
        <div
            data-slot="empty-media"
            data-variant={variant}
            className={cn(
                "flex items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground",
                {
                    "size-14": variant === "default",
                    "size-12 rounded-full": variant === "icon",
                },
                className,
            )}
            {...props}
        />
    );
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"h3">) {
    return (
        <h3
            data-slot="empty-title"
            className={cn("text-sm font-semibold text-foreground", className)}
            {...props}
        />
    );
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
    return (
        <p
            data-slot="empty-description"
            className={cn("text-sm text-muted-foreground", className)}
            {...props}
        />
    );
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="empty-content"
            className={cn("flex flex-wrap items-center justify-center gap-2", className)}
            {...props}
        />
    );
}

export { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle };
