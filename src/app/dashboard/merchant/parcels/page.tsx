import { PageHeader } from "@/components/shared/page-header";
import { ParcelTable } from "@/features/parcels/components/parcel-table";
import { listParcelsForMerchantUser } from "@/features/parcels/server/dal";
import { requireCurrentUser } from "@/lib/session";

export default async function MerchantParcelsPage() {
  const currentUser = await requireCurrentUser();
  const parcels = await listParcelsForMerchantUser(currentUser.id);

  return (
    <>
      <PageHeader title="My Parcels" description="Parcels owned by your merchant account." />
      <ParcelTable parcels={parcels} />
    </>
  );
}
