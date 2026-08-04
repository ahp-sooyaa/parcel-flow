import { Suspense } from "react";

import { PageLoading } from "@/components/shared/page-loading";
import { PageHeader } from "@/components/shared/page-header";
import { StorageCapacityCard } from "@/features/dashboard/components/storage-capacity-card";
import { getStorageStats } from "@/features/dashboard/server/dal";
import { RealtimeParcelSummaryCards } from "@/features/parcels/components/realtime-parcel-summary-cards";
import { getParcelSummary } from "@/features/parcels/server/dal";
import { DashboardSettlementWorkspace } from "@/features/settlements/components/dashboard-settlement-workspace";
import { getSettlementWorkspaceSummary } from "@/features/settlements/server/dal";
import { getCurrentUser } from "@/lib/session";

async function DashboardPageContent() {
  const [currentUser, summary, workspaceSummary] = await Promise.all([
    getCurrentUser(),
    getParcelSummary(),
    getSettlementWorkspaceSummary(),
  ]);
  const storageStats = currentUser?.role === "super_admin" ? await getStorageStats() : null;

  return (
    <div className="space-y-6" data-testid="page-dynamic-content">
      {storageStats ? (
        <div className="grid gap-3 xl:grid-cols-[minmax(320px,1.6fr)_minmax(0,5fr)]">
          <StorageCapacityCard initialStats={storageStats} />
          <RealtimeParcelSummaryCards summary={summary} />
        </div>
      ) : (
        <RealtimeParcelSummaryCards summary={summary} />
      )}
      <DashboardSettlementWorkspace
        merchantSummaries={workspaceSummary.merchants}
        riderHandoverSummaries={workspaceSummary.riderHandovers}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Daily office view for parcel intake, rider assignment, collection monitoring, and merchant settlement preparation."
      />
      <Suspense fallback={<PageLoading />}>
        <DashboardPageContent />
      </Suspense>
    </>
  );
}
