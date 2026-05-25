import { eq } from "drizzle-orm";

import { merchantSettlements } from "@/db/schema";
import type { FinancialItemType } from "@/lib/domain";

export const merchantSettlementEligibleItemTypes = [
  "cod_remit",
  "delivery_fee_deduction",
] as const satisfies FinancialItemType[];

export function calculateMerchantSettlementTotals(
  items: Array<{ itemType: (typeof merchantSettlementEligibleItemTypes)[number]; amount: number }>,
) {
  const totalCodAmount = items.reduce(
    (sum, item) => sum + (item.itemType === "cod_remit" ? item.amount : 0),
    0,
  );
  const totalDeliveryFeeDeduction = items.reduce(
    (sum, item) => sum + (item.itemType === "delivery_fee_deduction" ? item.amount : 0),
    0,
  );

  return {
    totalCodAmount,
    totalDeliveryFeeDeduction,
    netPaymentAmount: totalCodAmount - totalDeliveryFeeDeduction,
  };
}

export function formatBankAccountSummary(input: {
  bankName: string | null;
  accountNumber: string | null;
}) {
  if (!input.bankName || !input.accountNumber) {
    return null;
  }

  return `${input.bankName} • ${input.accountNumber}`;
}

export async function generateUniqueSettlementCode(dbLike: {
  select: typeof import("@/db").db.select;
}) {
  const datePart = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Bangkok",
  })
    .format(new Date())
    .replaceAll("-", "");

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = `MS-${datePart}-${Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, "0")}`;
    const [existingSettlement] = await dbLike
      .select({ id: merchantSettlements.id })
      .from(merchantSettlements)
      .where(eq(merchantSettlements.settlementCode, candidate))
      .limit(1);

    if (!existingSettlement) {
      return candidate;
    }
  }

  throw new Error("Unable to generate a unique settlement code.");
}
