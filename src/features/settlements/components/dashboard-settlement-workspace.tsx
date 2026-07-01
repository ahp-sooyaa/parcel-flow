"use client";

import dynamic from "next/dynamic";

import type {
  RiderCashHandoverSummaryDto,
  SettlementEligibleMerchantSummaryDto,
} from "@/features/settlements/server/dto";

const MerchantSettlementWorkspace = dynamic(
  () =>
    import("@/features/settlements/components/merchant-settlement-workspace").then(
      (module) => module.MerchantSettlementWorkspace,
    ),
  {
    loading: () => (
      <div className="h-48 animate-pulse rounded-lg border bg-white" aria-hidden="true" />
    ),
  },
);

export function DashboardSettlementWorkspace(
  props: Readonly<{
    merchantSummaries: SettlementEligibleMerchantSummaryDto[];
    riderHandoverSummaries: RiderCashHandoverSummaryDto[];
  }>,
) {
  return <MerchantSettlementWorkspace {...props} />;
}
