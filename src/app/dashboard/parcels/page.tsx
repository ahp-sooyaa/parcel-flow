import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { listMerchants } from "@/features/merchants/server/dal";
import { CreateParcelForm } from "@/features/parcels/components/create-parcel-form";
import { RealtimeParcelListView } from "@/features/parcels/components/realtime-parcel-list-view";
import { listParcels } from "@/features/parcels/server/dal";
import { listRiders } from "@/features/riders/server/dal";
import { listTownships } from "@/features/townships/server/dal";
import { isAdminRole } from "@/lib/domain";
import { requireCurrentUser } from "@/lib/session";

export default async function ParcelsPage() {
  const currentUser = await requireCurrentUser();

  if (!isAdminRole(currentUser.role)) {
    throw new Error("Admin access required.");
  }

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
            <Button asChild>
              <SheetTrigger>
                <Plus className="size-4" />
                Create Parcel
              </SheetTrigger>
            </Button>
            <SheetContent className="overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:w-[720px] data-[side=right]:sm:max-w-[720px]">
              <CreateParcelForm merchants={merchants} townships={townships} />
            </SheetContent>
          </Sheet>
        }
      />
      <RealtimeParcelListView
        actorRole={currentUser.role}
        parcels={parcels}
        merchants={merchants}
        riders={riders}
        townships={townships}
      />
    </>
  );
}
