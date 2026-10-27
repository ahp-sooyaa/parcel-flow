"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { TownshipForm } from "@/features/townships/components/township-form";

export function CreateTownshipSheet() {
  return (
    <Sheet>
      <Button asChild>
        <SheetTrigger>
          <Plus className="size-4" />
          Create Township
        </SheetTrigger>
      </Button>
      <SheetContent className="overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:w-[720px] data-[side=right]:sm:max-w-[720px]">
        <TownshipForm mode="create" />
      </SheetContent>
    </Sheet>
  );
}
