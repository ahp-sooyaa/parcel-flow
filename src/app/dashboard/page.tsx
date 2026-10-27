import { Suspense } from "react";

import { PageContentSkeleton } from "@/components/shared/page-content-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { StorageCapacityCard } from "@/features/dashboard/components/storage-capacity-card";
import { getStorageStats } from "@/features/dashboard/server/dal";
import { RealtimeParcelSummaryCards } from "@/features/parcels/components/realtime-parcel-summary-cards";
import { getParcelSummary } from "@/features/parcels/server/dal";
import { DashboardSettlementWorkspace } from "@/features/settlements/components/dashboard-settlement-workspace";
import { getSettlementWorkspaceSummary } from "@/features/settlements/server/dal";
import { getCurrentUser } from "@/lib/session";

async function ParcelSummarySection() {
  await getCurrentUser();
  const summary = await getParcelSummary();
  return <RealtimeParcelSummaryCards summary={summary} />;
}

async function StorageSection() {
  const currentUser = await getCurrentUser();

  if (currentUser?.role !== "super_admin") {
    return null;
  }

  const storageStats = await getStorageStats();
  return <StorageCapacityCard initialStats={storageStats} />;
}

async function SettlementWorkspaceSection() {
  await getCurrentUser();
  const workspaceSummary = await getSettlementWorkspaceSummary();

  return (
    <DashboardSettlementWorkspace
      merchantSummaries={workspaceSummary.merchants}
      riderHandoverSummaries={workspaceSummary.riderHandovers}
    />
  );
}

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Daily office view for parcel intake, rider assignment, collection monitoring, and merchant settlement preparation."
      />
      <div className="space-y-6" data-testid="page-dynamic-content">
        <div className="grid gap-3 xl:grid-cols-[minmax(320px,1.6fr)_minmax(0,5fr)]">
          <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-muted" />}>
            <StorageSection />
          </Suspense>
          <Suspense
            fallback={
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="h-24 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            }
          >
            <ParcelSummarySection />
          </Suspense>
        </div>
        <Suspense fallback={<PageContentSkeleton variant="block" />}>
          <SettlementWorkspaceSection />
        </Suspense>
      </div>
    </>
  );
}
