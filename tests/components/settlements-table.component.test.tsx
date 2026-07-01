import { describe, expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";

import type { SettlementListFiltersDto } from "@/features/settlements/server/dto";

const defaultFilters: SettlementListFiltersDto = {
  page: 1,
  pageSize: 20,
};

const resolveMerchantSettlementActionMock = mock(async () => ({
  ok: true as const,
  message: "Settlement marked as paid.",
}));

void mock.module("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined }),
  usePathname: () => "/dashboard/settlements",
}));

void mock.module("@/features/settlements/server/actions", () => ({
  resolveMerchantSettlementAction: resolveMerchantSettlementActionMock,
}));

describe("SettlementsTable", async () => {
  const { SettlementsTable } = await import("@/features/settlements/components/settlements-table");

  test("renders an empty state when no settlements exist", () => {
    render(
      <SettlementsTable
        pageResult={{
          settlements: [],
          page: 1,
          pageSize: 20,
          totalCount: 0,
          totalPages: 1,
        }}
        filters={defaultFilters}
        actorRole="super_admin"
      />,
    );

    expect(screen.getByText("No settlements.")).toBeTruthy();
  });
});
