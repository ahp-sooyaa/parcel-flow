import { Suspense } from "react";

import { PageLoading } from "@/components/shared/page-loading";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { listMerchantOptions } from "@/features/merchants/server/dal";
import { LazyCreateParcelForm } from "@/features/parcels/components/lazy-create-parcel-form";
import { RealtimeParcelListView } from "@/features/parcels/components/realtime-parcel-list-view";
import { listAdminParcelsPage } from "@/features/parcels/server/dal";
import { parseAdminParcelListFilters } from "@/features/parcels/server/dto";
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
      <div className="mb-4 flex justify-end" data-testid="page-header-actions">
        <Sheet>
          <Button asChild>
            <SheetTrigger>
              <Plus className="size-4" />
              Create Parcel
            </SheetTrigger>
          </Button>
          <SheetContent className="overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:w-[720px] data-[side=right]:sm:max-w-[720px]">
            <LazyCreateParcelForm merchants={merchants} townships={townships} />
          </SheetContent>
        </Sheet>
      </div>
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
      />
      <Suspense fallback={<PageLoading />}>
        <ParcelsPageContent {...props} />
      </Suspense>
    </>
  );
}
