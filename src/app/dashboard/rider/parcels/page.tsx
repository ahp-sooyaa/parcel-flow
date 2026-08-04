import { Suspense } from "react";

import { PageLoading } from "@/components/shared/page-loading";
import { PageHeader } from "@/components/shared/page-header";
import { RealtimeRiderParcelCardList } from "@/features/parcels/components/realtime-rider-parcel-card-list";
import { listRiderParcelsPageForUser } from "@/features/parcels/server/dal";
import { parseRiderParcelListFilters } from "@/features/parcels/server/dto";
import { listTownships } from "@/features/townships/server/dal";
import { requireCurrentUser } from "@/lib/session";

type RiderParcelsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function RiderParcelsPageContent({ searchParams }: Readonly<RiderParcelsPageProps>) {
  const currentUser = await requireCurrentUser();

  if (currentUser.role !== "rider") {
    throw new Error("Rider access required.");
  }

  const filters = parseRiderParcelListFilters((await searchParams) ?? {});
  const [pageResult, townships] = await Promise.all([
    listRiderParcelsPageForUser(currentUser.id, filters),
    listTownships(),
  ]);

  return (
    <>
      <PageHeader
        title="Assigned Parcels"
        description="Parcels currently assigned to your rider account."
      />
      <RealtimeRiderParcelCardList
        pageResult={pageResult}
        filters={filters}
        townships={townships}
      />
    </>
  );
}

export default function RiderParcelsPage(
  props: Readonly<Parameters<typeof RiderParcelsPageContent>[0]>,
) {
  return (
    <Suspense fallback={<PageLoading />}>
      <RiderParcelsPageContent {...props} />
    </Suspense>
  );
}
