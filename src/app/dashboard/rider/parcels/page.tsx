import { PageHeader } from "@/components/shared/page-header";
import { RealtimeRiderParcelCardList } from "@/features/parcels/components/realtime-rider-parcel-card-list";
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
      <RealtimeRiderParcelCardList parcels={parcels} />
    </>
  );
}
