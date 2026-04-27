"use client";

import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getDashboardNavigation } from "@/lib/dashboard-navigation";

import type { DashboardNavItem } from "@/lib/dashboard-navigation";

type DashboardHeaderNavProps = {
    navItems: DashboardNavItem[];
};

export function DashboardHeaderNav({ navItems }: Readonly<DashboardHeaderNavProps>) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const navigation = getDashboardNavigation({
        pathname,
        searchParams,
        navItems,
    });

    return (
        <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
                {navigation.backHref && (
                    <Button asChild size="sm" variant="outline" className="shrink-0">
                        <Link href={navigation.backHref}>
                            <ArrowLeft />
                            Back
                        </Link>
                    </Button>
                )}

                <nav aria-label="Breadcrumb" className="min-w-0">
                    <ol className="flex flex-wrap items-center gap-1 text-sm">
                        {navigation.breadcrumbs.map((breadcrumb, index) => {
                            const isCurrent = index === navigation.breadcrumbs.length - 1;

                            return (
                                <li
                                    key={`${breadcrumb.label}-${breadcrumb.href ?? index}`}
                                    className="flex min-w-0 items-center gap-1"
                                >
                                    {index > 0 && (
                                        <ChevronRight
                                            aria-hidden="true"
                                            className="size-3 text-muted-foreground"
                                        />
                                    )}

                                    {breadcrumb.href ? (
                                        <Link
                                            href={breadcrumb.href}
                                            className="font-medium text-muted-foreground transition-colors hover:text-foreground"
                                        >
                                            {breadcrumb.label}
                                        </Link>
                                    ) : (
                                        <span
                                            aria-current={isCurrent ? "page" : undefined}
                                            className="font-medium text-foreground"
                                        >
                                            {breadcrumb.label}
                                        </span>
                                    )}
                                </li>
                            );
                        })}
                    </ol>
                </nav>
            </div>
        </div>
    );
}
