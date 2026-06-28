import { PageHeader } from "@/components/shared/page-header";
import {
  RiderPayoutCreateAction,
  RiderPayoutWorkspace,
} from "@/features/rider-payouts/components/rider-payout-workspace";
import {
  listEligibleRiderPayoutRiders,
  listRiderPayouts,
} from "@/features/rider-payouts/server/dal";
import { canCreateRiderPayoutDraft } from "@/lib/permissions";
import { requireCurrentUser } from "@/lib/session";

export default async function RiderPayoutsPage() {
  const [actor, payouts, eligibleRiders] = await Promise.all([
    requireCurrentUser(),
    listRiderPayouts(),
    listEligibleRiderPayoutRiders(),
  ]);

  return (
    <>
      <PageHeader
        title="Rider Payouts"
        description="Create traceable rider payouts from pending delivery and merchant-return ways."
        actions={
          canCreateRiderPayoutDraft(actor.role) ? (
            <RiderPayoutCreateAction eligibleRiders={eligibleRiders} />
          ) : undefined
        }
      />
      <RiderPayoutWorkspace payouts={payouts} actorRole={actor.role} />
    </>
  );
}
