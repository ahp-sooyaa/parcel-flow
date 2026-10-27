import { Suspense } from "react";

import { PageContentSkeleton } from "@/components/shared/page-content-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { RealtimeMerchantOverviewSummaryCards } from "@/features/merchants/components/realtime-merchant-overview-summary-cards";
import { getMerchantOverviewSummary } from "@/features/merchants/server/dal";
import { MerchantSettlementHistoryTable } from "@/features/settlements/components/merchant-settlement-history-table";
import { listMerchantSettlementHistoryForUser } from "@/features/settlements/server/dal";
import { parseMerchantSettlementHistoryFilters } from "@/features/settlements/server/dto";
import { requireCurrentUser } from "@/lib/session";

type MerchantOverviewPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function MerchantOverviewPageContent({ searchParams }: Readonly<MerchantOverviewPageProps>) {
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
    <div data-testid="page-dynamic-content">
      <div className="space-y-6">
        <RealtimeMerchantOverviewSummaryCards summary={summary} />
        <MerchantSettlementHistoryTable history={history} filters={filters} />
      </div>
    </div>
  );
}

export default function MerchantOverviewPage(
  props: Readonly<Parameters<typeof MerchantOverviewPageContent>[0]>,
) {
  return (
    <>
      <PageHeader
        title="Overview"
        description="Track COD performance, paid remittances, and settled settlement history for your merchant account."
      />
      <Suspense fallback={<PageContentSkeleton variant="cards" />}>
        <MerchantOverviewPageContent {...props} />
      </Suspense>
    </>
  );
}
