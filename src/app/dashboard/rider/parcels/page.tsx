import { PageHeader } from "@/components/shared/page-header";
import { RiderParcelCardList } from "@/features/parcels/components/rider-parcel-card-list";
import { listParcelsForRiderUser } from "@/features/parcels/server/dal";
import { requireCurrentUser } from "@/lib/session";

export default async function RiderParcelsPage() {
  const currentUser = await requireCurrentUser();

  if (currentUser.role !== "rider") {
    throw new Error("Rider access required.");
  }

  const parcels = await listParcelsForRiderUser(currentUser.id);

  return (
    <>
      <PageHeader
        title="Assigned Parcels"
        description="Parcels currently assigned to your rider account."
      />
      <RiderParcelCardList parcels={parcels} />
    </>
  );
}
