"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { XIcon } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const Sheet = DialogPrimitive.Root;
const SheetPortal = DialogPrimitive.Portal;

type SheetTriggerProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger> & {
    asChild?: boolean;
};

const SheetTrigger = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Trigger>,
    SheetTriggerProps
>(({ asChild = false, children, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
        return (
            <DialogPrimitive.Trigger
                ref={ref as React.Ref<HTMLButtonElement>}
                render={children}
                {...props}
            />
        );
    }

    return (
        <DialogPrimitive.Trigger ref={ref as React.Ref<HTMLButtonElement>} {...props}>
            {children}
        </DialogPrimitive.Trigger>
    );
});
SheetTrigger.displayName = "SheetTrigger";

type SheetCloseProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close> & {
    asChild?: boolean;
};

const SheetClose = React.forwardRef<HTMLButtonElement, SheetCloseProps>(
    ({ asChild = false, children, ...props }, ref) => {
        if (asChild && React.isValidElement(children)) {
            return (
                <DialogPrimitive.Close
                    ref={ref as React.Ref<HTMLButtonElement>}
                    render={children}
                    {...props}
                />
            );
        }

        return (
            <DialogPrimitive.Close ref={ref as React.Ref<HTMLButtonElement>} {...props}>
                {children}
            </DialogPrimitive.Close>
        );
    },
);
SheetClose.displayName = "SheetClose";

const SheetOverlay = React.forwardRef<
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
SheetOverlay.displayName = "SheetOverlay";

const sheetVariants = cva(
    "fixed z-50 flex flex-col gap-4 border bg-background shadow-lg duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
    {
        variants: {
            side: {
                top: "inset-x-0 top-0 border-b p-6 data-[ending-style]:-translate-y-4 data-[starting-style]:-translate-y-4",
                right: "inset-y-0 right-0 h-full w-full border-l p-5 data-[ending-style]:translate-x-4 data-[starting-style]:translate-x-4 sm:max-w-lg sm:p-6",
                bottom: "inset-x-0 bottom-0 border-t p-6 data-[ending-style]:translate-y-4 data-[starting-style]:translate-y-4",
                left: "inset-y-0 left-0 h-full w-full border-r p-5 data-[ending-style]:-translate-x-4 data-[starting-style]:-translate-x-4 sm:max-w-lg sm:p-6",
            },
        },
        defaultVariants: {
            side: "right",
        },
    },
);

type SheetContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Popup> &
    VariantProps<typeof sheetVariants> & {
        showCloseButton?: boolean;
    };

const SheetContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Popup>,
    SheetContentProps
>(({ className, children, side, showCloseButton = true, ...props }, ref) => (
    <SheetPortal>
        <SheetOverlay />
        <DialogPrimitive.Popup
            ref={ref}
            className={cn(sheetVariants({ side }), className)}
            {...props}
        >
            {children}
            {showCloseButton ? (
                <DialogPrimitive.Close
                    className="absolute top-4 right-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none"
                    aria-label="Close sheet"
                >
                    <XIcon className="size-4" />
                </DialogPrimitive.Close>
            ) : null}
        </DialogPrimitive.Popup>
    </SheetPortal>
));
SheetContent.displayName = "SheetContent";

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
    return <div className={cn("flex flex-col gap-1.5 text-left", className)} {...props} />;
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
            {...props}
        />
    );
}

function SheetTitle({
    className,
    ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
    return (
        <DialogPrimitive.Title
            className={cn("text-lg font-semibold tracking-tight", className)}
            {...props}
        />
    );
}

function SheetDescription({
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
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetOverlay,
    SheetPortal,
    SheetTitle,
    SheetTrigger,
};
