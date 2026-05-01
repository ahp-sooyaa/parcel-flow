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
    getMerchantSettlementSelectionForViewer,
    getMerchantSettlementHistoryForViewer,
} from "@/features/merchant-settlements/server/dal";
import { getDefaultSettlementPreset } from "@/features/merchant-settlements/server/utils";
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
import { appendDashboardReturnTo, buildDashboardHref } from "@/lib/dashboard-navigation";
import { cn } from "@/lib/utils";

import type { BankAccountDto } from "@/features/bank-accounts/server/dto";

type MerchantDetailPageProps = {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type MerchantDetailTab = "parcels" | "settlements";

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

function getActiveTab(
    searchParams: Record<string, string | string[] | undefined>,
): MerchantDetailTab {
    return getSearchParam(searchParams, "tab") === "settlements" ? "settlements" : "parcels";
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
    const settlementPreset = getDefaultSettlementPreset(getSearchParam(rawSearchParams, "preset"));
    const requestedTab = getSearchParam(rawSearchParams, "tab");
    const activeTab = getActiveTab(rawSearchParams);

    if (isSettlementMode && !settlementAccess.canCreate) {
        notFound();
    }

    if (requestedTab === "settlements" && !settlementAccess.canView) {
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
        merchantStats,
        merchantParcels,
        settlementSelection,
        settlementBankAccounts,
        settlementHistory,
    ] = await Promise.all([
        getMerchantByIdForViewer(currentUser, id),
        getMerchantParcelStatsForViewer(currentUser, id),
        !isSettlementMode && activeTab === "parcels"
            ? getMerchantParcelsListForViewer(currentUser, id, parcelListQuery)
            : Promise.resolve(null),
        isSettlementMode
            ? getMerchantSettlementSelectionForViewer(currentUser, id)
            : Promise.resolve({ readyCandidates: [], blockedCandidates: [] }),
        isSettlementMode
            ? Promise.all([
                  getBankAccountsForViewer(currentUser, {
                      appUserId: id,
                      isCompanyAccount: false,
                  }),
                  getBankAccountsForViewer(currentUser, {
                      appUserId: null,
                      isCompanyAccount: true,
                  }),
              ])
            : Promise.resolve([[], []] as [BankAccountDto[], BankAccountDto[]]),
        !isSettlementMode && activeTab === "settlements" && settlementAccess.canView
            ? getMerchantSettlementHistoryForViewer(currentUser, id)
            : Promise.resolve([]),
    ]);

    if (!merchant) {
        notFound();
    }

    const parcelAccess = getParcelAccess({ viewer: currentUser });
    const merchantDetailHref = `/dashboard/merchants/${merchant.id}`;
    const merchantReturnToHref = buildDashboardHref(merchantDetailHref, rawSearchParams);
    const settlementHistoryHref = `${merchantDetailHref}?tab=settlements`;
    const settlementModeHref = `${merchantDetailHref}?settle=1`;
    const processSettlementHref = `${settlementModeHref}&preset=cod`;
    const resolveFeesHref = `${settlementModeHref}&preset=fees`;
    const handleReturnsHref = `${settlementModeHref}&preset=returns`;
    const [merchantBankAccounts, companyBankAccounts] = settlementBankAccounts;
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
            : appendDashboardReturnTo(`/dashboard/users/${merchant.id}/edit`, merchantReturnToHref);
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
            actionHref:
                settlementAccess.canCreate && merchantStats.returnedParcels > 0
                    ? handleReturnsHref
                    : null,
            actionLabel: "Handle Returns",
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
            actionHref:
                settlementAccess.canCreate && Number(merchantStats.codInHeld) > 0
                    ? processSettlementHref
                    : null,
            actionLabel: "Process Settlement",
        },
        {
            label: "Pending Delivery Fee",
            value: formatMmk(merchantStats.pendingDeliveryFee),
            actionHref:
                settlementAccess.canCreate && Number(merchantStats.pendingDeliveryFee) > 0
                    ? resolveFeesHref
                    : null,
            actionLabel: "Resolve Fees",
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
                        {settlementAccess.canCreate && (
                            <Button asChild variant="outline">
                                <Link href={settlementModeHref}>Open Settlement Workspace</Link>
                            </Button>
                        )}
                        {parcelAccess.canCreate && (
                            <Button asChild>
                                <Link href={`/dashboard/parcels/create?merchantId=${merchant.id}`}>
                                    Create Parcel
                                </Link>
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
                                Review ready and blocked merchant settlement candidates from one
                                workspace.
                            </p>
                        </div>
                        <Button asChild variant="outline">
                            <Link href={merchantDetailHref}>Exit Settlement Mode</Link>
                        </Button>
                    </div>

                    <MerchantSettlementPicker
                        merchantId={merchant.id}
                        readyCandidates={settlementSelection.readyCandidates}
                        blockedCandidates={settlementSelection.blockedCandidates}
                        merchantBankAccounts={merchantBankAccounts}
                        companyBankAccounts={companyBankAccounts}
                        preset={settlementPreset}
                    />
                </section>
            ) : (
                <section className="space-y-4">
                    <nav
                        className="flex items-center gap-1 overflow-x-auto border-b"
                        aria-label="Merchant detail tabs"
                    >
                        <Link
                            href={merchantDetailHref}
                            className={cn(
                                "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                                {
                                    "border-primary text-foreground": activeTab === "parcels",
                                    "border-transparent text-muted-foreground hover:text-foreground":
                                        activeTab !== "parcels",
                                },
                            )}
                        >
                            Parcels
                        </Link>

                        {settlementAccess.canView && (
                            <Link
                                href={settlementHistoryHref}
                                className={cn(
                                    "border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                                    {
                                        "border-primary text-foreground":
                                            activeTab === "settlements",
                                        "border-transparent text-muted-foreground hover:text-foreground":
                                            activeTab !== "settlements",
                                    },
                                )}
                            >
                                Settlement History
                            </Link>
                        )}
                    </nav>

                    {activeTab === "parcels" && merchantParcels && (
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
                                                    <th className="px-4 py-3">
                                                        Delivery Fee Status
                                                    </th>
                                                </>
                                            )}
                                            <th className="px-4 py-3">Settlement</th>
                                            <th className="px-4 py-3">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {merchantParcels.items.map((parcel) => (
                                            <tr key={parcel.id} className="border-t">
                                                <td className="px-4 py-3">{parcel.parcelCode}</td>
                                                <td className="px-4 py-3">
                                                    {parcel.recipientName}
                                                </td>
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
                                                            <Link
                                                                href={appendDashboardReturnTo(
                                                                    `/dashboard/parcels/${parcel.id}`,
                                                                    merchantReturnToHref,
                                                                )}
                                                            >
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
                                                            <Button
                                                                asChild
                                                                size="sm"
                                                                variant="outline"
                                                            >
                                                                <Link
                                                                    href={appendDashboardReturnTo(
                                                                        `/dashboard/parcels/${parcel.id}/edit`,
                                                                        merchantReturnToHref,
                                                                    )}
                                                                >
                                                                    Edit
                                                                </Link>
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {merchantParcels.items.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={showInternalPaymentColumns ? 9 : 7}
                                                    className="px-4 py-10 text-center text-xs text-muted-foreground"
                                                >
                                                    {hasActiveParcelListFilters(parcelListQuery)
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

                    {activeTab === "settlements" && settlementAccess.canView && (
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
            )}
        </section>
    );
}
