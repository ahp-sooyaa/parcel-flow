"use client";

import type { ReactNode } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type CreateUserSheetProps = Readonly<{
  children: ReactNode;
  triggerLabel: string;
  className?: string;
}>;

export function CreateUserSheet({ children, triggerLabel, className }: CreateUserSheetProps) {
  return (
    <Sheet>
      <Button asChild>
        <SheetTrigger>
          <Plus className="size-4" />
          {triggerLabel}
        </SheetTrigger>
      </Button>
      <SheetContent
        className={cn(
          "gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:w-[500px] data-[side=right]:sm:max-w-[500px]",
          className,
        )}
      >
        {children}
      </SheetContent>
    </Sheet>
  );
}
