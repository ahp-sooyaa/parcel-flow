import { Plus, Route } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ParcelTable } from "@/features/parcels/components/parcel-table";
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
      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_220px_220px_220px]">
        <Input placeholder="Search parcel code, receiver phone, receiver name, merchant" />
        <Input placeholder="Township" />
        <Input placeholder="Rider" />
        <Input placeholder="Status" />
      </div>
      <ParcelTable parcels={parcels} />
    </>
  );
}
