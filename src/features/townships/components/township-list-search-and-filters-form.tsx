"use client";

import { SlidersHorizontalIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type TownshipListSearchAndFiltersFormProps = {
    query: string;
    clearHref: string;
    className?: string;
};

function getActiveFilterSummary(query: string) {
    const activeFilters = [];

    if (query) {
        activeFilters.push("Search");
    }

    return {
        activeFilters,
        hasActiveFilters: activeFilters.length > 0,
    };
}

export function TownshipListSearchAndFiltersForm({
    query,
    clearHref,
    className,
}: Readonly<TownshipListSearchAndFiltersFormProps>) {
    const { activeFilters, hasActiveFilters } = getActiveFilterSummary(query);

    return (
        <div
            className={cn(
                "flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between",
                className,
            )}
        >
            <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">Search and Filters</p>
                <p className="truncate text-sm text-muted-foreground">
                    {hasActiveFilters
                        ? `${activeFilters.length} filter${activeFilters.length === 1 ? "" : "s"} applied`
                        : "No filters applied"}
                </p>
            </div>

            <div className="flex items-center gap-2">
                {hasActiveFilters ? (
                    <Button asChild size="sm" variant="outline">
                        <Link href={clearHref}>Clear</Link>
                    </Button>
                ) : null}

                <Sheet>
                    <SheetTrigger asChild>
                        <Button size="sm" variant="outline">
                            <SlidersHorizontalIcon />
                            Filters
                        </Button>
                    </SheetTrigger>

                    <SheetContent
                        side="bottom"
                        className="max-h-[85vh] rounded-t-2xl border-x-0 border-b-0"
                    >
                        <form
                            action={clearHref}
                            className="flex h-full flex-col gap-0"
                            method="get"
                        >
                            <SheetHeader className="pr-8">
                                <SheetTitle>Filters</SheetTitle>
                                <SheetDescription>
                                    Search townships and narrow the list.
                                </SheetDescription>
                            </SheetHeader>

                            <div className="flex-1 space-y-6 overflow-y-auto py-6">
                                <div className="space-y-2">
                                    <Label htmlFor="township-list-search">Search</Label>
                                    <Input
                                        id="township-list-search"
                                        name="q"
                                        defaultValue={query}
                                        placeholder="Search by township name"
                                    />
                                </div>
                            </div>

                            <SheetFooter className="mt-auto border-t pt-4">
                                <Button asChild type="button" variant="outline">
                                    <Link href={clearHref}>Reset</Link>
                                </Button>
                                <SheetClose asChild>
                                    <Button type="submit">Apply Filters</Button>
                                </SheetClose>
                            </SheetFooter>
                        </form>
                    </SheetContent>
                </Sheet>
            </div>
        </div>
    );
}
