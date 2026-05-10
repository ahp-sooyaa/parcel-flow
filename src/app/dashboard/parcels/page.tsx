import { Plus, Route } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { listMerchants } from "@/features/merchants/server/dal";
import { CreateParcelForm } from "@/features/parcels/components/create-parcel-form";
import { ParcelListView } from "@/features/parcels/components/parcel-list-view";
import { listParcels } from "@/features/parcels/server/dal";
import { listTownships } from "@/features/townships/server/dal";

export default async function ParcelsPage() {
  const [parcels, merchants, townships] = await Promise.all([listParcels(), listMerchants(), listTownships()]);

  return (
    <>
      <PageHeader
        title="Parcels"
        description="Search, filter, create, and batch assign parcels after they arrive at the office."
        actions={
          <>
            <Button variant="outline">
              <Route className="size-4" />
              Assign Rider
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button>
                  <Plus className="size-4" />
                  Create Parcel
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full max-w-[560px] overflow-hidden p-0">
                <CreateParcelForm merchants={merchants} townships={townships} />
              </SheetContent>
            </Sheet>
          </>
        }
      />
      <ParcelListView parcels={parcels} merchants={merchants} townships={townships} />
    </>
  );
}
