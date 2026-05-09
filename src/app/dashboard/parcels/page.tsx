import { Plus, Route } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ParcelListView } from "@/features/parcels/components/parcel-list-view";
import { listParcels } from "@/features/parcels/server/dal";

export default async function ParcelsPage() {
  const parcels = await listParcels();

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
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Create Parcel</SheetTitle>
                  <SheetDescription>
                    Right-side sheet placeholder for merchant, saved contact, township pricing, COD, and pickup images.
                  </SheetDescription>
                </SheetHeader>
              </SheetContent>
            </Sheet>
          </>
        }
      />
      <ParcelListView parcels={parcels} />
    </>
  );
}
