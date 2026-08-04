import { Suspense } from "react";

import { PageContentSkeleton } from "@/components/shared/page-content-skeleton";
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
  const actor = await requireCurrentUser();
  const pageResult = await listSettlementsPage(filters);

  return (
    <div data-testid="page-dynamic-content">
      <SettlementsTable pageResult={pageResult} filters={filters} actorRole={actor.role} />
    </div>
  );
}

export default function SettlementsPage(
  props: Readonly<Parameters<typeof SettlementsPageContent>[0]>,
) {
  return (
    <>
      <PageHeader
        title="Merchant Settlements"
        description="Review generated settlements and resolve pending payouts after bank transfer confirmation."
      />
      <Suspense fallback={<PageContentSkeleton variant="table" />}>
        <SettlementsPageContent {...props} />
      </Suspense>
    </>
  );
}
