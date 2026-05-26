import { PageHeader } from "@/components/shared/page-header";
import { StorageCapacityCard } from "@/features/dashboard/components/storage-capacity-card";
import { getStorageStats } from "@/features/dashboard/server/dal";
import { RealtimeParcelSummaryCards } from "@/features/parcels/components/realtime-parcel-summary-cards";
import { getParcelSummary } from "@/features/parcels/server/dal";
import { MerchantSettlementWorkspace } from "@/features/settlements/components/merchant-settlement-workspace";
import {
  listEligibleSettlementMerchants,
  listPendingRiderCashHandovers,
} from "@/features/settlements/server/dal";
import { getCurrentUser } from "@/lib/session";

export default async function DashboardPage() {
  const [currentUser, summary, merchants, riderHandovers] = await Promise.all([
    getCurrentUser(),
    getParcelSummary(),
    listEligibleSettlementMerchants(),
    listPendingRiderCashHandovers(),
  ]);
  const storageStats = currentUser?.role === "super_admin" ? await getStorageStats() : null;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Daily office view for parcel intake, rider assignment, collection monitoring, and merchant settlement preparation."
      />
      <div className="space-y-6">
        {storageStats ? (
          <div className="grid gap-3 xl:grid-cols-[minmax(320px,1.6fr)_minmax(0,5fr)]">
            <StorageCapacityCard initialStats={storageStats} />
            <RealtimeParcelSummaryCards summary={summary} />
          </div>
        ) : (
          <RealtimeParcelSummaryCards summary={summary} />
        )}
        <MerchantSettlementWorkspace merchants={merchants} riderHandovers={riderHandovers} />
      </div>
    </>
  );
}
