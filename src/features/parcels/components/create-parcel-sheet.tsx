"use client";

import type { ReactNode } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function CreateParcelSheet({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Sheet>
      <Button asChild>
        <SheetTrigger>
          <Plus className="size-4" />
          Create Parcel
        </SheetTrigger>
      </Button>
      <SheetContent className="overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:w-[720px] data-[side=right]:sm:max-w-[720px]">
        {children}
      </SheetContent>
    </Sheet>
  );
}
