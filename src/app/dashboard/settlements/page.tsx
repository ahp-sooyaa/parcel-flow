import { PageHeader } from "@/components/shared/page-header";
import { SettlementsTable } from "@/features/settlements/components/settlements-table";
import { listSettlements } from "@/features/settlements/server/dal";
import { requireCurrentUser } from "@/lib/session";

export default async function SettlementsPage() {
  const [actor, settlements] = await Promise.all([requireCurrentUser(), listSettlements()]);

  return (
    <>
      <PageHeader
        title="Merchant Settlements"
        description="Review generated settlements and resolve pending payouts after bank transfer confirmation."
      />
      <SettlementsTable settlements={settlements} actorRole={actor.role} />
    </>
  );
}
