import { Suspense } from "react";

import { PageLoading } from "@/components/shared/page-loading";
import { PageHeader } from "@/components/shared/page-header";
import { SettlementsTable } from "@/features/settlements/components/settlements-table";
import { listSettlementsPage } from "@/features/settlements/server/dal";
import { parseSettlementListFilters } from "@/features/settlements/server/dto";
import { requireCurrentUser } from "@/lib/session";

type SettlementsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function SettlementsPageContent({ searchParams }: Readonly<SettlementsPageProps>) {
  const filters = parseSettlementListFilters((await searchParams) ?? {});
  const [actor, pageResult] = await Promise.all([
    requireCurrentUser(),
    listSettlementsPage(filters),
  ]);

  return (
    <>
      <PageHeader
        title="Merchant Settlements"
        description="Review generated settlements and resolve pending payouts after bank transfer confirmation."
      />
      <SettlementsTable pageResult={pageResult} filters={filters} actorRole={actor.role} />
    </>
  );
}

export default function SettlementsPage(
  props: Readonly<Parameters<typeof SettlementsPageContent>[0]>,
) {
  return (
    <Suspense fallback={<PageLoading />}>
      <SettlementsPageContent {...props} />
    </Suspense>
  );
}
