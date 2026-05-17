import { PageHeader } from "@/components/shared/page-header";
import { ParcelTable } from "@/features/parcels/components/parcel-table";
import { listParcelsForRiderUser } from "@/features/parcels/server/dal";
import { requireCurrentUser } from "@/lib/session";

export default async function RiderParcelsPage() {
  const currentUser = await requireCurrentUser();
  const parcels = await listParcelsForRiderUser(currentUser.id);

  return (
    <>
      <PageHeader
        title="Assigned Parcels"
        description="Parcels currently assigned to your rider account."
      />
      <ParcelTable parcels={parcels} />
    </>
  );
}
