import { Suspense } from "react";

import { PageContentSkeleton } from "@/components/shared/page-content-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { CreateTownshipHeaderAction } from "@/features/townships/components/create-township-header-action";
import { TownshipManagement } from "@/features/townships/components/township-management";
import { listTownships } from "@/features/townships/server/dal";
import { canManageTownshipPricing } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";

async function TownshipsPageContent() {
  const currentUser = await getCurrentUser();
  const townships = await listTownships();
  const canManagePricing = currentUser ? canManageTownshipPricing(currentUser.role) : false;

  return (
    <div data-testid="page-dynamic-content">
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
        actions={
          <Suspense fallback={null}>
            <CreateTownshipHeaderAction />
          </Suspense>
        }
      />
      <Suspense fallback={<PageContentSkeleton variant="table" />}>
        <TownshipsPageContent />
      </Suspense>
    </>
  );
}
