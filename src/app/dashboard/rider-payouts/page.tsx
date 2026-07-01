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

export default async function RiderPayoutsPage({ searchParams }: Readonly<RiderPayoutsPageProps>) {
  const filters = parseRiderPayoutListFilters((await searchParams) ?? {});
  const [actor, pageResult] = await Promise.all([
    requireCurrentUser(),
    listRiderPayoutsPage(filters),
  ]);

  return (
    <>
      <PageHeader
        title="Rider Payouts"
        description="Create traceable rider payouts from pending delivery and merchant-return ways."
        actions={canCreateRiderPayoutDraft(actor.role) ? <RiderPayoutCreateAction /> : undefined}
      />
      <RiderPayoutWorkspace pageResult={pageResult} filters={filters} actorRole={actor.role} />
    </>
  );
}
