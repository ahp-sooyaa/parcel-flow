import { Suspense } from "react";

import { PageLoading } from "@/components/shared/page-loading";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { TownshipForm } from "@/features/townships/components/township-form";
import { TownshipManagement } from "@/features/townships/components/township-management";
import { listTownships } from "@/features/townships/server/dal";
import { canManageTownshipPricing } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";

async function TownshipsPageContent() {
  const [townships, currentUser] = await Promise.all([listTownships(), getCurrentUser()]);
  const canManagePricing = currentUser ? canManageTownshipPricing(currentUser.role) : false;

  return (
    <div data-testid="page-dynamic-content">
      <div className="mb-4 flex justify-end" data-testid="page-header-actions">
        {canManagePricing ? (
          <Sheet>
            <Button asChild>
              <SheetTrigger>
                <Plus className="size-4" />
                Create Township
              </SheetTrigger>
            </Button>
            <SheetContent className="overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:w-[720px] data-[side=right]:sm:max-w-[720px]">
              <TownshipForm mode="create" />
            </SheetContent>
          </Sheet>
        ) : undefined}
      </div>
      <TownshipManagement townships={townships} canManagePricing={canManagePricing} />
    </div>
  );
}

export default function TownshipsPage() {
  return (
    <>
      <PageHeader
        title="Townships"
        description="Township-based delivery pricing used to auto-fill parcel delivery fees."
      />
      <Suspense fallback={<PageLoading />}>
        <TownshipsPageContent />
      </Suspense>
    </>
  );
}
