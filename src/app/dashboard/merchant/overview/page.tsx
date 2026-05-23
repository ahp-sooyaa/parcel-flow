import { PageHeader } from "@/components/shared/page-header";
import { MerchantOverviewSummaryCards } from "@/features/merchants/components/merchant-overview-summary-cards";
import { getMerchantOverviewSummary } from "@/features/merchants/server/dal";
import { MerchantSettlementHistoryTable } from "@/features/settlements/components/merchant-settlement-history-table";
import { listMerchantSettlementHistoryForUser } from "@/features/settlements/server/dal";
import { parseMerchantSettlementHistoryFilters } from "@/features/settlements/server/dto";
import { requireCurrentUser } from "@/lib/session";

type MerchantOverviewPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MerchantOverviewPage({
  searchParams,
}: Readonly<MerchantOverviewPageProps>) {
  const currentUser = await requireCurrentUser();

  if (currentUser.role !== "merchant") {
    throw new Error("Merchant access required.");
  }

  const filters = parseMerchantSettlementHistoryFilters((await searchParams) ?? {});
  const [summary, history] = await Promise.all([
    getMerchantOverviewSummary(currentUser.id),
    listMerchantSettlementHistoryForUser(currentUser.id, filters),
  ]);

  return (
    <>
      <PageHeader
        title="Overview"
        description="Track COD performance, paid remittances, and settled settlement history for your merchant account."
      />
      <div className="space-y-6">
        <MerchantOverviewSummaryCards summary={summary} />
        <MerchantSettlementHistoryTable history={history} filters={filters} />
      </div>
    </>
  );
}
