"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Backdrop>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Backdrop>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Backdrop
        ref={ref}
        className={cn(
            "fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
            className,
        )}
        {...props}
    />
));
DialogOverlay.displayName = "DialogOverlay";

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Popup> & {
    showCloseButton?: boolean;
};

const DialogContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Popup>,
    DialogContentProps
>(({ className, children, showCloseButton = true, ...props }, ref) => (
    <DialogPortal>
        <DialogOverlay />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <DialogPrimitive.Popup
                ref={ref}
                className={cn(
                    "relative z-50 grid w-full max-w-2xl gap-4 rounded-2xl border bg-background p-6 shadow-lg duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 sm:p-7",
                    className,
                )}
                {...props}
            >
                {children}
                {showCloseButton ? (
                    <DialogPrimitive.Close
                        className="absolute top-4 right-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none"
                        aria-label="Close dialog"
                    >
                        <XIcon className="size-4" />
                    </DialogPrimitive.Close>
                ) : null}
            </DialogPrimitive.Popup>
        </div>
    </DialogPortal>
));
DialogContent.displayName = "DialogContent";

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
    return <div className={cn("space-y-1.5", className)} {...props} />;
}

function DialogTitle({
    className,
    ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
    return (
        <DialogPrimitive.Title
            className={cn("text-lg leading-none font-semibold tracking-tight", className)}
            {...props}
        />
    );
}

function DialogDescription({
    className,
    ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
    return (
        <DialogPrimitive.Description
            className={cn("text-sm text-muted-foreground", className)}
            {...props}
        />
    );
}

export {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogOverlay,
    DialogPortal,
    DialogTitle,
    DialogTrigger,
};
