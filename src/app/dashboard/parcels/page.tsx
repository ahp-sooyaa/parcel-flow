import Link from "next/link";
import { notFound } from "next/navigation";
import { ListPagination } from "@/components/shared/list-pagination";
import { Button } from "@/components/ui/button";
import { getParcelAccess } from "@/features/auth/server/policies/parcels";
import { requireAppAccessContext } from "@/features/auth/server/utils";
import { ParcelListSearchAndFiltersForm } from "@/features/parcels/components/parcel-list-search-and-filters-form";
import { ParcelListTable } from "@/features/parcels/components/parcel-list-table";
import { getParcelFormOptions, getParcelsListForViewer } from "@/features/parcels/server/dal";
import {
    getParcelOperationSummary,
    hasActiveParcelListFilters,
    normalizeParcelListQueryParams,
} from "@/features/parcels/server/utils";
import { appendDashboardReturnTo, buildDashboardHref } from "@/lib/dashboard-navigation";

type ParcelsPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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
    const [parcels, formOptions] = await Promise.all([
        getParcelsListForViewer(currentUser, parcelListQuery),
        getParcelFormOptions(),
    ]);
    const { created: _created, ...returnSearchParams } = rawSearchParams;
    const createdCount = parseCreatedCount(rawSearchParams.created);
    const parcelsReturnTo = buildDashboardHref("/dashboard/parcels", returnSearchParams);
    const parcelPaginationQuery = {
        q: parcelListQuery.query || undefined,
        riderAssignment:
            parcelListQuery.riderAssignment === "all" ? undefined : parcelListQuery.riderAssignment,
        parcelStatus: parcelListQuery.parcelStatus,
        codStatus: parcelListQuery.codStatus,
        collectionStatus: parcelListQuery.collectionStatus,
        deliveryFeeStatus: parcelListQuery.deliveryFeeStatus,
        merchantSettlementStatus: parcelListQuery.merchantSettlementStatus,
    };
    const riderAssignmentFilterHrefs = {
        all: buildDashboardHref("/dashboard/parcels", {
            ...parcelPaginationQuery,
            riderAssignment: undefined,
            page: undefined,
        }),
        unassigned: buildDashboardHref("/dashboard/parcels", {
            ...parcelPaginationQuery,
            riderAssignment: "unassigned",
            page: undefined,
        }),
        assigned: buildDashboardHref("/dashboard/parcels", {
            ...parcelPaginationQuery,
            riderAssignment: "assigned",
            page: undefined,
        }),
    } as const;
    const parcelRows = parcels.items.map((parcel) => {
        const operations = getParcelOperationSummary(parcel);

        return {
            id: parcel.id,
            parcelCode: parcel.parcelCode,
            merchantLabel: parcel.merchantLabel,
            riderLabel: parcel.riderLabel,
            recipientName: parcel.recipientName,
            recipientPhone: parcel.recipientPhone,
            recipientTownshipName: parcel.recipientTownshipName,
            parcelStatus: parcel.parcelStatus,
            actionHref: appendDashboardReturnTo(
                parcelAccess.canUpdate
                    ? `/dashboard/parcels/${parcel.id}#operations`
                    : `/dashboard/parcels/${parcel.id}`,
                parcelsReturnTo,
            ),
            detailHref: appendDashboardReturnTo(
                `/dashboard/parcels/${parcel.id}/edit`,
                parcelsReturnTo,
            ),
            actionLabel: parcelAccess.canUpdate ? operations.primaryActionLabel : "View Parcel",
            operations: {
                cash: operations.cash,
                deliveryFee: operations.deliveryFee,
                settlement: {
                    label: operations.settlement.label,
                    tone: operations.settlement.tone,
                    blockedReason: operations.settlement.blockedReasons[0] ?? null,
                },
            },
        };
    });
    const riderOptions = formOptions.riders.map((rider) => ({
        value: rider.id,
        label: rider.label,
    }));
    const emptyMessage = hasActiveParcelListFilters(parcelListQuery)
        ? "No parcels match the current search or filters."
        : "No parcels found.";

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

            <ParcelListTable
                rows={parcelRows}
                riderOptions={riderOptions}
                canUpdate={parcelAccess.canUpdate}
                emptyMessage={emptyMessage}
                riderAssignmentFilter={parcelListQuery.riderAssignment}
                riderAssignmentFilterHrefs={riderAssignmentFilterHrefs}
            />

            <ListPagination
                basePath="/dashboard/parcels"
                query={parcelPaginationQuery}
                pagination={parcels}
                itemLabel="parcels"
            />
        </section>
    );
}
