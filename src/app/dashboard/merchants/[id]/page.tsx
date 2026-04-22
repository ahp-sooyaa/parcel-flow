import Link from "next/link";
import { notFound } from "next/navigation";
import { ListPagination } from "@/components/shared/list-pagination";
import { Button } from "@/components/ui/button";
import { getMerchantAccess } from "@/features/auth/server/policies/merchant";
import { getMerchantSettlementAccess } from "@/features/auth/server/policies/merchant-settlements";
import { getParcelAccess } from "@/features/auth/server/policies/parcels";
import { isAdminRole } from "@/features/auth/server/policies/shared";
import { requireAppAccessContext } from "@/features/auth/server/utils";
import { getBankAccountsForViewer } from "@/features/bank-accounts/server/dal";
import { MerchantSettlementHistory } from "@/features/merchant-settlements/components/merchant-settlement-history";
import { MerchantSettlementPicker } from "@/features/merchant-settlements/components/merchant-settlement-picker";
import {
    getEligibleMerchantSettlementParcelsForViewer,
    getMerchantSettlementHistoryForViewer,
} from "@/features/merchant-settlements/server/dal";
import { getMerchantByIdForViewer } from "@/features/merchant/server/dal";
import { ParcelListSearchAndFiltersForm } from "@/features/parcels/components/parcel-list-search-and-filters-form";
import { ParcelStatusPill } from "@/features/parcels/components/parcel-status-pill";
import {
    getMerchantParcelStatsForViewer,
    getMerchantParcelsListForViewer,
} from "@/features/parcels/server/dal";
import {
    hasActiveParcelListFilters,
    normalizeParcelListQueryParams,
} from "@/features/parcels/server/utils";

type MerchantDetailPageProps = {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const countFormatter = new Intl.NumberFormat("en-US");
const moneyFormatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
});

function formatCount(value: number) {
    return countFormatter.format(value);
}

function formatMmk(value: string) {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return "0 MMK";
    }

    return `${moneyFormatter.format(amount)} MMK`;
}

function getSearchParam(searchParams: Record<string, string | string[] | undefined>, key: string) {
    const value = searchParams[key];

    if (Array.isArray(value)) {
        return value[0] ?? "";
    }

    return value ?? "";
}

export default async function MerchantDetailPage({
    params,
    searchParams,
}: Readonly<MerchantDetailPageProps>) {
    const currentUser = await requireAppAccessContext();
    const [{ id }, rawSearchParams] = await Promise.all([params, searchParams]);
    const showInternalPaymentColumns = isAdminRole(currentUser.roleSlug);
    const settlementAccess = getMerchantSettlementAccess(currentUser);
    const isSettlementMode = getSearchParam(rawSearchParams, "settle") === "1";

    if (isSettlementMode && !settlementAccess.canCreate) {
        notFound();
    }

    const parcelListQuery = normalizeParcelListQueryParams(rawSearchParams, {
        includeInternalPaymentFilters: showInternalPaymentColumns,
    });

    const merchantAccess = getMerchantAccess({
        viewer: currentUser,
        merchantAppUserId: id,
    });

    if (!merchantAccess.canView) {
        notFound();
    }

    const [
        merchant,
        merchantParcels,
        merchantStats,
        eligibleSettlementParcels,
        merchantBankAccounts,
        settlementHistory,
    ] = await Promise.all([
        getMerchantByIdForViewer(currentUser, id),
        getMerchantParcelsListForViewer(currentUser, id, parcelListQuery),
        getMerchantParcelStatsForViewer(currentUser, id),
        isSettlementMode
            ? getEligibleMerchantSettlementParcelsForViewer(currentUser, id)
            : Promise.resolve([]),
        isSettlementMode
            ? getBankAccountsForViewer(currentUser, {
                  appUserId: id,
                  isCompanyAccount: false,
              })
            : Promise.resolve([]),
        settlementAccess.canView
            ? getMerchantSettlementHistoryForViewer(currentUser, id)
            : Promise.resolve([]),
    ]);

    if (!merchant) {
        notFound();
    }

    const parcelAccess = getParcelAccess({ viewer: currentUser });
    const emptyColumnCount = showInternalPaymentColumns ? 9 : 7;
    const hasActiveParcelFilters = hasActiveParcelListFilters(parcelListQuery);
    const merchantParcelItems = merchantParcels.items;
    const merchantDetailHref = `/dashboard/merchants/${merchant.id}`;
    const settlementModeHref = `${merchantDetailHref}?settle=1`;
    const parcelPaginationQuery = {
        q: parcelListQuery.query || undefined,
        parcelStatus: parcelListQuery.parcelStatus,
        codStatus: parcelListQuery.codStatus,
        collectionStatus: parcelListQuery.collectionStatus,
        deliveryFeeStatus: parcelListQuery.deliveryFeeStatus,
        merchantSettlementStatus: parcelListQuery.merchantSettlementStatus,
    };

    const editMerchantHref =
        currentUser.roleSlug === "merchant"
            ? "/dashboard/settings?tab=merchant-details"
            : `/dashboard/users/${merchant.id}/edit`;
    const statCards: Array<{
        label: string;
        value: string;
        actionHref?: string | null;
        actionLabel?: string;
    }> = [
        {
            label: "Total Parcels",
            value: formatCount(merchantStats.totalParcels),
        },
        {
            label: "Delivered",
            value: formatCount(merchantStats.deliveredParcels),
        },
        {
            label: "Returned",
            value: formatCount(merchantStats.returnedParcels),
        },
        {
            label: "Total COD Collected",
            value: formatMmk(merchantStats.totalCodCollected),
        },
        {
            label: "COD Remitted",
            value: formatMmk(merchantStats.codRemitted),
        },
        {
            label: "COD in Held",
            value: formatMmk(merchantStats.codInHeld),
            actionHref: settlementAccess.canCreate ? settlementModeHref : null,
            actionLabel: "Settle",
        },
        {
            label: "Pending Delivery Fee",
            value: formatMmk(merchantStats.pendingDeliveryFee),
        },
    ];

    return (
        <section className="mx-auto w-full space-y-6">
            <header className="rounded-xl border bg-card p-5">
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 space-y-3">
                        <h1 className="text-2xl font-semibold break-words">{merchant.shopName}</h1>
                        <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-4">
                            <p className="font-medium text-foreground">{merchant.contactName}</p>
                            <p>{merchant.phoneNumber ?? "-"}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {merchantAccess.canUpdate && (
                            <Button asChild variant="outline">
                                <Link href={editMerchantHref}>Edit Merchant Profile</Link>
                            </Button>
                        )}
                        {parcelAccess.canCreate && (
                            <Button asChild>
                                <Link href="/dashboard/parcels/create">Create Parcel</Link>
                            </Button>
                        )}
                    </div>
                </div>
            </header>

            <section className="space-y-3">
                <h2 className="text-lg font-semibold">Stats</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {statCards.map((stat) => (
                        <article key={stat.label} className="rounded-xl border bg-card p-4">
                            <p className="text-xs font-medium text-muted-foreground uppercase">
                                {stat.label}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                                <p className="text-2xl font-semibold tabular-nums">{stat.value}</p>
                                {stat.actionHref && (
                                    <Button asChild size="sm" variant="outline">
                                        <Link href={stat.actionHref}>{stat.actionLabel}</Link>
                                    </Button>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            {isSettlementMode ? (
                <section className="space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold">Settlement Mode</h2>
                            <p className="text-sm text-muted-foreground">
                                Delivered COD parcels with collected COD and pending settlement.
                            </p>
                        </div>
                        <Button asChild variant="outline">
                            <Link href={merchantDetailHref}>Exit Settlement Mode</Link>
                        </Button>
                    </div>

                    <MerchantSettlementPicker
                        merchantId={merchant.id}
                        parcels={eligibleSettlementParcels}
                        bankAccounts={merchantBankAccounts}
                    />
                </section>
            ) : (
                <section className="space-y-3">
                    <div>
                        <h2 className="text-lg font-semibold">Parcels</h2>
                        <p className="text-sm text-muted-foreground">
                            Only parcels related to this merchant are listed here.
                        </p>
                    </div>

                    <ParcelListSearchAndFiltersForm
                        query={parcelListQuery}
                        clearHref={merchantDetailHref}
                        includeInternalPaymentFilters={showInternalPaymentColumns}
                    />

                    <div className="overflow-x-auto rounded-xl border bg-card">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted/40 text-xs uppercase">
                                <tr>
                                    <th className="px-4 py-3">Parcel Code</th>
                                    <th className="px-4 py-3">Recipient</th>
                                    <th className="px-4 py-3">Township</th>
                                    <th className="px-4 py-3">Parcel Status</th>
                                    <th className="px-4 py-3">COD Status</th>
                                    {showInternalPaymentColumns && (
                                        <>
                                            <th className="px-4 py-3">Collection Status</th>
                                            <th className="px-4 py-3">Delivery Fee Status</th>
                                        </>
                                    )}
                                    <th className="px-4 py-3">Settlement</th>
                                    <th className="px-4 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {merchantParcelItems.map((parcel) => (
                                    <tr key={parcel.id} className="border-t">
                                        <td className="px-4 py-3">{parcel.parcelCode}</td>
                                        <td className="px-4 py-3">{parcel.recipientName}</td>
                                        <td className="px-4 py-3">
                                            {parcel.recipientTownshipName ?? "-"}
                                        </td>
                                        <td className="px-4 py-3">
                                            <ParcelStatusPill value={parcel.parcelStatus} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <ParcelStatusPill value={parcel.codStatus} />
                                        </td>
                                        {showInternalPaymentColumns && (
                                            <>
                                                <td className="px-4 py-3">
                                                    <ParcelStatusPill
                                                        value={parcel.collectionStatus}
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <ParcelStatusPill
                                                        value={parcel.deliveryFeeStatus}
                                                    />
                                                </td>
                                            </>
                                        )}
                                        <td className="px-4 py-3">
                                            <ParcelStatusPill
                                                value={parcel.merchantSettlementStatus}
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Button asChild size="sm" variant="outline">
                                                    <Link href={`/dashboard/parcels/${parcel.id}`}>
                                                        View
                                                    </Link>
                                                </Button>
                                                {getParcelAccess({
                                                    viewer: currentUser,
                                                    parcel: {
                                                        merchantId: parcel.merchantId,
                                                        riderId: parcel.riderId,
                                                    },
                                                }).canUpdate && (
                                                    <Button asChild size="sm" variant="outline">
                                                        <Link
                                                            href={`/dashboard/parcels/${parcel.id}/edit`}
                                                        >
                                                            Edit
                                                        </Link>
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {merchantParcelItems.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={emptyColumnCount}
                                            className="px-4 py-10 text-center text-xs text-muted-foreground"
                                        >
                                            {hasActiveParcelFilters
                                                ? "No parcels match the current search or filters."
                                                : "No parcels found for this merchant."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <ListPagination
                        basePath={merchantDetailHref}
                        query={parcelPaginationQuery}
                        pagination={merchantParcels}
                        itemLabel="parcels"
                    />
                </section>
            )}

            {settlementAccess.canView && (
                <section className="space-y-3">
                    <h2 className="text-lg font-semibold">Settlement History</h2>
                    <MerchantSettlementHistory
                        settlements={settlementHistory}
                        permissions={{
                            canConfirm: settlementAccess.canConfirm,
                            canCancel: settlementAccess.canCancel,
                        }}
                    />
                </section>
            )}
        </section>
    );
}
