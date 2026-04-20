import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ListFilterOption = {
    value: string;
    label: string;
};

export type ListFilterField = {
    name: string;
    label: string;
    value?: string | null;
    allLabel?: string;
    options: readonly ListFilterOption[];
};

type ListSearchAndFiltersFormProps = {
    searchName?: string;
    searchLabel?: string;
    searchValue?: string;
    searchPlaceholder?: string;
    filters?: readonly ListFilterField[];
    clearHref: string;
    submitLabel?: string;
    className?: string;
};

export function ListSearchAndFiltersForm({
    searchName = "q",
    searchLabel = "Search",
    searchValue = "",
    searchPlaceholder = "Search",
    filters = [],
    clearHref,
    submitLabel = "Search",
    className,
}: Readonly<ListSearchAndFiltersFormProps>) {
    return (
        <form className={cn("space-y-3 rounded-xl border bg-card p-3", className)} method="get">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <div className="grid gap-1.5 md:col-span-2 xl:col-span-2">
                    <label
                        className="text-xs font-medium text-muted-foreground"
                        htmlFor={`list-${searchName}`}
                    >
                        {searchLabel}
                    </label>
                    <input
                        id={`list-${searchName}`}
                        name={searchName}
                        defaultValue={searchValue}
                        placeholder={searchPlaceholder}
                        className="h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
                    />
                </div>

                {filters.map((filter) => (
                    <div key={filter.name} className="grid gap-1.5">
                        <label
                            className="text-xs font-medium text-muted-foreground"
                            htmlFor={`list-${filter.name}`}
                        >
                            {filter.label}
                        </label>
                        <select
                            id={`list-${filter.name}`}
                            name={filter.name}
                            defaultValue={filter.value ?? ""}
                            className="h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                        >
                            <option value="">{filter.allLabel ?? `All ${filter.label}`}</option>
                            {filter.options.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
                <Button type="submit" size="sm">
                    {submitLabel}
                </Button>
                <Button asChild variant="outline" size="sm">
                    <Link href={clearHref}>Clear</Link>
                </Button>
            </div>
        </form>
    );
}
