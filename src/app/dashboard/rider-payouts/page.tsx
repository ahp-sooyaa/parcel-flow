import { Suspense } from "react";

import { PageContentSkeleton } from "@/components/shared/page-content-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { RiderPayoutHeaderAction } from "@/features/rider-payouts/components/rider-payout-header-action";
import { RiderPayoutWorkspace } from "@/features/rider-payouts/components/rider-payout-workspace";
import { listRiderPayoutsPage } from "@/features/rider-payouts/server/dal";
import { parseRiderPayoutListFilters } from "@/features/rider-payouts/server/dto";
import { requireCurrentUser } from "@/lib/session";

type RiderPayoutsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function RiderPayoutsPageContent({ searchParams }: Readonly<RiderPayoutsPageProps>) {
  const filters = parseRiderPayoutListFilters((await searchParams) ?? {});
  const actor = await requireCurrentUser();
  const pageResult = await listRiderPayoutsPage(filters);

  return (
    <div data-testid="page-dynamic-content">
      <RiderPayoutWorkspace pageResult={pageResult} filters={filters} actorRole={actor.role} />
    </div>
  );
}

export default function RiderPayoutsPage(
  props: Readonly<Parameters<typeof RiderPayoutsPageContent>[0]>,
) {
  return (
    <>
      <PageHeader
        title="Rider Payouts"
        description="Create traceable rider payouts from pending delivery and merchant-return ways."
        actions={
          <Suspense fallback={null}>
            <RiderPayoutHeaderAction />
          </Suspense>
        }
      />
      <Suspense fallback={<PageContentSkeleton variant="table" />}>
        <RiderPayoutsPageContent {...props} />
      </Suspense>
    </>
  );
}
