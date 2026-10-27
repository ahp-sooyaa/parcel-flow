import { RiderPayoutCreateAction } from "@/features/rider-payouts/components/rider-payout-workspace";
import { canCreateRiderPayoutDraft } from "@/lib/permissions";
import { requireCurrentUser } from "@/lib/session";

export async function RiderPayoutHeaderAction() {
  const actor = await requireCurrentUser();

  if (!canCreateRiderPayoutDraft(actor.role)) {
    return null;
  }

  return <RiderPayoutCreateAction />;
}
