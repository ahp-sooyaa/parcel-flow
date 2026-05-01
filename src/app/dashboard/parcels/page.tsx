import Link from "next/link";
import { notFound } from "next/navigation";
import { ListPagination } from "@/components/shared/list-pagination";
import { Button } from "@/components/ui/button";
import { getParcelAccess } from "@/features/auth/server/policies/parcels";
import { requireAppAccessContext } from "@/features/auth/server/utils";
import { ParcelListSearchAndFiltersForm } from "@/features/parcels/components/parcel-list-search-and-filters-form";
import { ParcelStatusPill } from "@/features/parcels/components/parcel-status-pill";
import { getParcelsListForViewer } from "@/features/parcels/server/dal";
import {
    getParcelOperationSummary,
    hasActiveParcelListFilters,
    normalizeParcelListQueryParams,
} from "@/features/parcels/server/utils";
import { appendDashboardReturnTo, buildDashboardHref } from "@/lib/dashboard-navigation";
import { cn } from "@/lib/utils";

type ParcelsPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type OperationTone = "muted" | "info" | "success" | "warning" | "danger";

const operationToneClasses = {
    muted: "border-border bg-muted text-muted-foreground",
    info: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300",
    success:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300",
    warning:
        "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300",
    danger: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300",
} satisfies Record<OperationTone, string>;

function OperationState({
    label,
    tone,
}: Readonly<{
    label: string;
    tone: OperationTone;
}>) {
    return (
        <span
            className={cn(
                "inline-flex h-6 items-center rounded-full border px-2.5 text-xs leading-none font-medium whitespace-nowrap",
                operationToneClasses[tone],
            )}
        >
            {label}
        </span>
    );
}

function parseCreatedCount(value: string | string[] | undefined) {
    const normalized = Array.isArray(value) ? value[0] : value;
    const count = Number(normalized);

    if (!Number.isSafeInteger(count) || count < 1) {
        return null;
    }

    return count;
}

export default async function ParcelsPage({ searchParams }: Readonly<ParcelsPageProps>) {
    // admin user - permission check
    // rider user - no access
    // merchant user - no access
    const currentUser = await requireAppAccessContext();
    const rawSearchParams = await searchParams;
    const parcelAccess = getParcelAccess({ viewer: currentUser });

    if (!parcelAccess.canViewList) {
        notFound();
    }

    const parcelListQuery = normalizeParcelListQueryParams(rawSearchParams);
    const parcels = await getParcelsListForViewer(currentUser, parcelListQuery);
    const { created: _created, ...returnSearchParams } = rawSearchParams;
    const createdCount = parseCreatedCount(rawSearchParams.created);
    const parcelsReturnTo = buildDashboardHref("/dashboard/parcels", returnSearchParams);
    const parcelPaginationQuery = {
        q: parcelListQuery.query || undefined,
        parcelStatus: parcelListQuery.parcelStatus,
        codStatus: parcelListQuery.codStatus,
        collectionStatus: parcelListQuery.collectionStatus,
        deliveryFeeStatus: parcelListQuery.deliveryFeeStatus,
        merchantSettlementStatus: parcelListQuery.merchantSettlementStatus,
    };

    return (
        <section className="space-y-5">
            <header className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Parcels</h1>
                    <p className="text-sm text-muted-foreground">
                        Create and manage parcel operations with linked payment states.
                    </p>
                </div>
                {parcelAccess.canCreate && (
                    <Button asChild>
                        <Link href="/dashboard/parcels/create">Create Parcel</Link>
                    </Button>
                )}
            </header>

            <ParcelListSearchAndFiltersForm
                query={parcelListQuery}
                clearHref="/dashboard/parcels"
            />

            {createdCount ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    Created {createdCount} parcel{createdCount === 1 ? "" : "s"} successfully.
                </div>
            ) : null}

            <div className="overflow-x-auto rounded-xl border bg-card">
                <table className="w-full text-left text-sm">
                    <thead className="bg-muted/40 text-xs uppercase">
                        <tr>
                            <th className="px-4 py-3">Parcel Code</th>
                            <th className="px-4 py-3">Merchant</th>
                            <th className="px-4 py-3">Recipient</th>
                            <th className="px-4 py-3">Township</th>
                            <th className="px-4 py-3">Parcel Status</th>
                            <th className="px-4 py-3">Cash</th>
                            <th className="px-4 py-3">Fee</th>
                            <th className="px-4 py-3">Settlement</th>
                            <th className="px-4 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {parcels.items.map((parcel) => {
                            const operations = getParcelOperationSummary(parcel);
                            const actionHref = appendDashboardReturnTo(
                                parcelAccess.canUpdate
                                    ? `/dashboard/parcels/${parcel.id}#operations`
                                    : `/dashboard/parcels/${parcel.id}`,
                                parcelsReturnTo,
                            );

                            return (
                                <tr key={parcel.id} className="border-t">
                                    <td className="px-4 py-3 font-mono text-xs">
                                        {parcel.parcelCode}
                                    </td>
                                    <td className="px-4 py-3">{parcel.merchantLabel}</td>
                                    <td className="px-4 py-3">
                                        <div className="grid gap-1">
                                            <span>{parcel.recipientName}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {parcel.recipientPhone}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {parcel.recipientTownshipName ?? "-"}
                                    </td>
                                    <td className="px-4 py-3">
                                        <ParcelStatusPill value={parcel.parcelStatus} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <OperationState
                                            label={operations.cash.label}
                                            tone={operations.cash.tone}
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <OperationState
                                            label={operations.deliveryFee.label}
                                            tone={operations.deliveryFee.tone}
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="grid gap-1">
                                            <OperationState
                                                label={operations.settlement.label}
                                                tone={operations.settlement.tone}
                                            />
                                            {operations.settlement.blockedReasons[0] && (
                                                <span className="max-w-52 text-xs text-muted-foreground">
                                                    {operations.settlement.blockedReasons[0]}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <Button asChild size="sm">
                                                <Link href={actionHref}>
                                                    {parcelAccess.canUpdate
                                                        ? operations.primaryActionLabel
                                                        : "View Parcel"}
                                                </Link>
                                            </Button>
                                            {parcelAccess.canUpdate && (
                                                <Button asChild size="sm" variant="outline">
                                                    <Link
                                                        href={appendDashboardReturnTo(
                                                            `/dashboard/parcels/${parcel.id}/edit`,
                                                            parcelsReturnTo,
                                                        )}
                                                    >
                                                        Details
                                                    </Link>
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {parcels.items.length === 0 && (
                            <tr>
                                <td
                                    colSpan={9}
                                    className="px-4 py-10 text-center text-xs text-muted-foreground"
                                >
                                    {hasActiveParcelListFilters(parcelListQuery)
                                        ? "No parcels match the current search or filters."
                                        : "No parcels found."}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <ListPagination
                basePath="/dashboard/parcels"
                query={parcelPaginationQuery}
                pagination={parcels}
                itemLabel="parcels"
            />
        </section>
    );
}
