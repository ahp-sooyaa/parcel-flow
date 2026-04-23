import Link from "next/link";
import { notFound } from "next/navigation";
import { ListPagination } from "@/components/shared/list-pagination";
import { Button } from "@/components/ui/button";
import { getMerchantSettlementAccess } from "@/features/auth/server/policies/merchant-settlements";
import { requireAppAccessContext } from "@/features/auth/server/utils";
import { MerchantSettlementListSearchAndFiltersForm } from "@/features/merchant-settlements/components/merchant-settlement-list-search-and-filters-form";
import { MerchantSettlementStatusPill } from "@/features/merchant-settlements/components/merchant-settlement-status-pill";
import { getMerchantSettlementsListForViewer } from "@/features/merchant-settlements/server/dal";
import {
    buildMerchantSettlementListHref,
    normalizeMerchantSettlementListQueryParams,
} from "@/features/merchant-settlements/server/utils";

type SettlementsPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const moneyFormatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
});
const dateFormatter = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
    month: "short",
    timeZone: "Asia/Yangon",
    year: "numeric",
});

function formatMmk(value: string) {
    const amount = Number(value);

    return `${moneyFormatter.format(Number.isFinite(amount) ? amount : 0)} MMK`;
}

function buildDetailHref(settlementId: string, returnTo: string) {
    return `/dashboard/settlements/${settlementId}?returnTo=${encodeURIComponent(returnTo)}`;
}

export default async function SettlementsPage({ searchParams }: Readonly<SettlementsPageProps>) {
    const currentUser = await requireAppAccessContext();
    const settlementAccess = getMerchantSettlementAccess(currentUser);

    if (!settlementAccess.canView) {
        notFound();
    }

    const rawSearchParams = await searchParams;
    const query = normalizeMerchantSettlementListQueryParams(rawSearchParams);
    const settlements = await getMerchantSettlementsListForViewer(currentUser, query);
    const returnTo = buildMerchantSettlementListHref({
        ...query,
        page: settlements.page,
    });
    const paginationQuery = {
        q: query.query || undefined,
        status: query.status,
    };

    return (
        <section className="space-y-5">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">Settlements</h1>
                <p className="text-sm text-muted-foreground">
                    Review merchant COD settlements across all merchants.
                </p>
            </header>

            <MerchantSettlementListSearchAndFiltersForm
                query={query}
                clearHref="/dashboard/settlements"
            />

            <div className="overflow-x-auto rounded-xl border bg-card">
                <table className="w-full text-left text-sm">
                    <thead className="bg-muted/40 text-xs uppercase">
                        <tr>
                            <th className="px-4 py-3">Settlement</th>
                            <th className="px-4 py-3">Merchant</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Parcels</th>
                            <th className="px-4 py-3">Net Payable</th>
                            <th className="px-4 py-3">Created By</th>
                            <th className="px-4 py-3">Confirmed By</th>
                            <th className="px-4 py-3">Updated</th>
                            <th className="px-4 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {settlements.items.map((settlement) => (
                            <tr key={settlement.id} className="border-t">
                                <td className="px-4 py-3">
                                    <p className="font-medium">
                                        {settlement.referenceNo ??
                                            `Settlement ${settlement.id.slice(0, 8)}`}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {settlement.id.slice(0, 8)}
                                    </p>
                                </td>
                                <td className="px-4 py-3">
                                    <Link
                                        href={`/dashboard/merchants/${settlement.merchantId}?tab=settlements`}
                                        className="font-medium underline-offset-4 hover:underline"
                                    >
                                        {settlement.merchantLabel}
                                    </Link>
                                </td>
                                <td className="px-4 py-3">
                                    <MerchantSettlementStatusPill value={settlement.status} />
                                </td>
                                <td className="px-4 py-3 tabular-nums">{settlement.itemCount}</td>
                                <td className="px-4 py-3 font-medium tabular-nums">
                                    {formatMmk(settlement.totalAmount)}
                                </td>
                                <td className="px-4 py-3">{settlement.createdByName}</td>
                                <td className="px-4 py-3">{settlement.confirmedByName ?? "-"}</td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    {dateFormatter.format(settlement.updatedAt)}
                                </td>
                                <td className="px-4 py-3">
                                    <Button asChild size="sm" variant="outline">
                                        <Link href={buildDetailHref(settlement.id, returnTo)}>
                                            View
                                        </Link>
                                    </Button>
                                </td>
                            </tr>
                        ))}
                        {settlements.items.length === 0 && (
                            <tr>
                                <td
                                    colSpan={9}
                                    className="px-4 py-10 text-center text-xs text-muted-foreground"
                                >
                                    No settlements found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <ListPagination
                basePath="/dashboard/settlements"
                query={paginationQuery}
                pagination={settlements}
                itemLabel="settlements"
            />
        </section>
    );
}
