import { PageHeader } from "@/components/shared/page-header";
import { ParcelSummaryCards } from "@/features/parcels/components/parcel-summary-cards";
import { ParcelTable } from "@/features/parcels/components/parcel-table";
import { getParcelSummary, listParcels } from "@/features/parcels/server/dal";

export default async function DashboardPage() {
  const [summary, parcels] = await Promise.all([getParcelSummary(), listParcels()]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Daily office view for parcel intake, rider assignment, and collection monitoring."
      />
      <div className="space-y-6">
        <ParcelSummaryCards summary={summary} />
        <ParcelTable parcels={parcels} />
      </div>
    </>
  );
}
