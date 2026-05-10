import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { listMerchants } from "@/features/merchants/server/dal";
import { CreateParcelForm } from "@/features/parcels/components/create-parcel-form";
import { ParcelListView } from "@/features/parcels/components/parcel-list-view";
import { listParcels } from "@/features/parcels/server/dal";
import { listRiders } from "@/features/riders/server/dal";
import { listTownships } from "@/features/townships/server/dal";

export default async function ParcelsPage() {
  const [parcels, merchants, riders, townships] = await Promise.all([
    listParcels(),
    listMerchants(),
    listRiders(),
    listTownships(),
  ]);

  return (
    <>
      <PageHeader
        title="Parcels"
        description="Search, filter, create, and batch assign parcels after they arrive at the office."
        actions={
          <Sheet>
            <SheetTrigger asChild>
              <Button>
                <Plus className="size-4" />
                Create Parcel
              </Button>
            </SheetTrigger>
            <SheetContent className="overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:w-[720px] data-[side=right]:sm:max-w-[720px]">
              <CreateParcelForm merchants={merchants} townships={townships} />
            </SheetContent>
          </Sheet>
        }
      />
      <ParcelListView parcels={parcels} merchants={merchants} riders={riders} townships={townships} />
    </>
  );
}
