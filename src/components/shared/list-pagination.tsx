import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ListPaginationState = {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
};

type ListPaginationProps = {
    basePath: string;
    query?: Record<string, string | string[] | null | undefined>;
    pagination: ListPaginationState;
    itemLabel?: string;
    className?: string;
};

type PageToken = number | { type: "gap"; afterPage: number };

function buildPageTokens(page: number, totalPages: number): PageToken[] {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const pages = new Set([1, totalPages, page - 1, page, page + 1]);

    if (page <= 3) {
        pages.add(2);
        pages.add(3);
        pages.add(4);
    }

    if (page >= totalPages - 2) {
        pages.add(totalPages - 3);
        pages.add(totalPages - 2);
        pages.add(totalPages - 1);
    }

    const sortedPages = Array.from(pages)
        .filter((candidate) => candidate >= 1 && candidate <= totalPages)
        .sort((a, b) => a - b);
    const tokens: PageToken[] = [];

    for (const candidate of sortedPages) {
        const previous = tokens.at(-1);

        if (typeof previous === "number" && candidate - previous > 1) {
            tokens.push({
                type: "gap",
                afterPage: previous,
            });
        }

        tokens.push(candidate);
    }

    return tokens;
}

function buildPageHref(
    basePath: string,
    query: Record<string, string | string[] | null | undefined>,
    page: number,
) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
        if (key === "page" || value == null) {
            continue;
        }

        if (Array.isArray(value)) {
            for (const item of value) {
                if (item) {
                    params.append(key, item);
                }
            }

            continue;
        }

        if (value) {
            params.set(key, value);
        }
    }

    if (page > 1) {
        params.set("page", String(page));
    }

    const queryString = params.toString();

    return queryString ? `${basePath}?${queryString}` : basePath;
}

export function ListPagination({
    basePath,
    query = {},
    pagination,
    itemLabel = "items",
    className,
}: Readonly<ListPaginationProps>) {
    const { page, pageSize, totalItems, totalPages } = pagination;

    if (totalItems === 0) {
        return null;
    }

    const firstItem = (page - 1) * pageSize + 1;
    const lastItem = Math.min(page * pageSize, totalItems);
    const pageTokens = buildPageTokens(page, totalPages);

    return (
        <nav
            aria-label="Pagination"
            className={cn(
                "flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between",
                className,
            )}
        >
            <p>
                Showing{" "}
                <span className="font-medium text-foreground tabular-nums">{firstItem}</span>
                {"-"}
                <span className="font-medium text-foreground tabular-nums">{lastItem}</span> of{" "}
                <span className="font-medium text-foreground tabular-nums">{totalItems}</span>{" "}
                {itemLabel}
            </p>

            {totalPages > 1 && (
                <div className="flex flex-wrap items-center gap-1.5">
                    {page > 1 ? (
                        <Button asChild variant="outline" size="sm">
                            <Link href={buildPageHref(basePath, query, page - 1)}>Previous</Link>
                        </Button>
                    ) : (
                        <Button disabled variant="outline" size="sm">
                            Previous
                        </Button>
                    )}

                    {pageTokens.map((token) =>
                        typeof token === "number" ? (
                            <Button
                                key={token}
                                asChild
                                variant={token === page ? "default" : "outline"}
                                size="sm"
                            >
                                <Link
                                    href={buildPageHref(basePath, query, token)}
                                    aria-current={token === page ? "page" : undefined}
                                >
                                    {token}
                                </Link>
                            </Button>
                        ) : (
                            <span
                                key={`gap-after-${token.afterPage}`}
                                className="flex h-7 min-w-7 items-center justify-center px-1"
                            >
                                ...
                            </span>
                        ),
                    )}

                    {page < totalPages ? (
                        <Button asChild variant="outline" size="sm">
                            <Link href={buildPageHref(basePath, query, page + 1)}>Next</Link>
                        </Button>
                    ) : (
                        <Button disabled variant="outline" size="sm">
                            Next
                        </Button>
                    )}
                </div>
            )}
        </nav>
    );
}
