import { Suspense } from "react";

import { PageLoading } from "@/components/shared/page-loading";
import { PageHeader } from "@/components/shared/page-header";
import { SheetFormFallback } from "@/components/shared/sheet-form-fallback";
import { CreateParcelFormLoader } from "@/features/parcels/components/create-parcel-form-loader";
import { CreateParcelSheet } from "@/features/parcels/components/create-parcel-sheet";
import { RealtimeParcelListView } from "@/features/parcels/components/realtime-parcel-list-view";
import { listAdminParcelsPage } from "@/features/parcels/server/dal";
import { parseAdminParcelListFilters } from "@/features/parcels/server/dto";
import { listMerchantOptions } from "@/features/merchants/server/dal";
import { listRiderOptions } from "@/features/riders/server/dal";
import { listTownships } from "@/features/townships/server/dal";
import { isAdminRole } from "@/lib/domain";
import { requireCurrentUser } from "@/lib/session";

type ParcelsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function ParcelsPageContent({ searchParams }: Readonly<ParcelsPageProps>) {
  const currentUser = await requireCurrentUser();

  if (!isAdminRole(currentUser.role)) {
    throw new Error("Admin access required.");
  }

  const filters = parseAdminParcelListFilters((await searchParams) ?? {});
  const [pageResult, merchants, riders, townships] = await Promise.all([
    listAdminParcelsPage(filters),
    listMerchantOptions(),
    listRiderOptions(),
    listTownships(),
  ]);

  return (
    <div data-testid="page-dynamic-content">
      <RealtimeParcelListView
        actorRole={currentUser.role}
        pageResult={pageResult}
        filters={filters}
        merchants={merchants}
        riders={riders}
        townships={townships}
      />
    </div>
  );
}

export default function ParcelsPage(props: Readonly<Parameters<typeof ParcelsPageContent>[0]>) {
  return (
    <>
      <PageHeader
        title="Parcels"
        description="Search, filter, create, and batch assign parcels after they arrive at the office."
        actions={
          <CreateParcelSheet>
            <Suspense fallback={<SheetFormFallback />}>
              <CreateParcelFormLoader />
            </Suspense>
          </CreateParcelSheet>
        }
      />
      <Suspense fallback={<PageLoading />}>
        <ParcelsPageContent {...props} />
      </Suspense>
    </>
  );
}
