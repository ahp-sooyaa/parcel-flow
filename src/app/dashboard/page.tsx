import { PageHeader } from "@/components/shared/page-header";
import { ParcelSummaryCards } from "@/features/parcels/components/parcel-summary-cards";
import { getParcelSummary } from "@/features/parcels/server/dal";
import { MerchantSettlementWorkspace } from "@/features/settlements/components/merchant-settlement-workspace";
import { listEligibleSettlementMerchants } from "@/features/settlements/server/dal";

export default async function DashboardPage() {
  const [summary, merchants] = await Promise.all([
    getParcelSummary(),
    listEligibleSettlementMerchants(),
  ]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Daily office view for parcel intake, rider assignment, collection monitoring, and merchant settlement preparation."
      />
      <div className="space-y-6">
        <ParcelSummaryCards summary={summary} />
        <MerchantSettlementWorkspace merchants={merchants} />
      </div>
    </>
  );
}
