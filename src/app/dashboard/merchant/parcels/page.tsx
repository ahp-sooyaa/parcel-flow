import { Suspense } from "react";

import { PageLoading } from "@/components/shared/page-loading";
import { PageHeader } from "@/components/shared/page-header";
import { RealtimeMerchantParcelBrowser } from "@/features/parcels/components/realtime-merchant-parcel-browser";
import { listMerchantParcelsPageForUser } from "@/features/parcels/server/dal";
import { parseMerchantParcelListFilters } from "@/features/parcels/server/dto";
import { requireCurrentUser } from "@/lib/session";

type MerchantParcelsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function MerchantParcelsPageContent({ searchParams }: Readonly<MerchantParcelsPageProps>) {
  const currentUser = await requireCurrentUser();

  if (currentUser.role !== "merchant") {
    throw new Error("Merchant access required.");
  }

  const filters = parseMerchantParcelListFilters((await searchParams) ?? {});
  const parcels = await listMerchantParcelsPageForUser(currentUser.id, filters);

  return (
    <>
      <PageHeader
        title="My Parcels"
        description="Search and track parcel delivery progress for your merchant account."
      />
      <RealtimeMerchantParcelBrowser result={parcels} filters={filters} />
    </>
  );
}

export default function MerchantParcelsPage(
  props: Readonly<Parameters<typeof MerchantParcelsPageContent>[0]>,
) {
  return (
    <Suspense fallback={<PageLoading />}>
      <MerchantParcelsPageContent {...props} />
    </Suspense>
  );
}
