import { Suspense } from "react";

import { PageLoading } from "@/components/shared/page-loading";
import { PageHeader } from "@/components/shared/page-header";
import {
  RiderPayoutCreateAction,
  RiderPayoutWorkspace,
} from "@/features/rider-payouts/components/rider-payout-workspace";
import { listRiderPayoutsPage } from "@/features/rider-payouts/server/dal";
import { parseRiderPayoutListFilters } from "@/features/rider-payouts/server/dto";
import { canCreateRiderPayoutDraft } from "@/lib/permissions";
import { requireCurrentUser } from "@/lib/session";

type RiderPayoutsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function RiderPayoutsPageContent({ searchParams }: Readonly<RiderPayoutsPageProps>) {
  const filters = parseRiderPayoutListFilters((await searchParams) ?? {});
  const [actor, pageResult] = await Promise.all([
    requireCurrentUser(),
    listRiderPayoutsPage(filters),
  ]);

  return (
    <div data-testid="page-dynamic-content">
      <div className="mb-4 flex justify-end" data-testid="page-header-actions">
        {canCreateRiderPayoutDraft(actor.role) ? <RiderPayoutCreateAction /> : undefined}
      </div>
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
      />
      <Suspense fallback={<PageLoading />}>
        <RiderPayoutsPageContent {...props} />
      </Suspense>
    </>
  );
}
