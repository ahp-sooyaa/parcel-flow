import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { financialItems, parcels, riderPayouts } from "@/db/schema";
import { isFinancialItemStatus, type FinancialItemStatus } from "@/lib/domain";

export function isRiderWayPayoutItem(item: { itemType: string }) {
  return item.itemType === "rider_way_payout";
}

export function aggregateRiderPayoutStatus(statuses: FinancialItemStatus[]) {
  const activeStatuses = statuses.filter((status) => status !== "void");

  if (activeStatuses.some((status) => status === "pending")) {
    return "pending" as const;
  }

  if (activeStatuses.some((status) => status === "in_progress")) {
    return "in_progress" as const;
  }

  if (activeStatuses.length > 0 && activeStatuses.every((status) => status === "settled")) {
    return "settled" as const;
  }

  return "pending" as const;
}

export async function recomputeParcelRiderPayoutStatuses(
  dbLike: Pick<typeof db, "select" | "update">,
  parcelIds: string[],
) {
  const uniqueParcelIds = Array.from(new Set(parcelIds));

  if (uniqueParcelIds.length === 0) {
    return;
  }

  const rows = await dbLike
    .select({
      parcelId: financialItems.parcelId,
      status: financialItems.status,
    })
    .from(financialItems)
    .where(
      and(
        inArray(financialItems.parcelId, uniqueParcelIds),
        eq(financialItems.itemType, "rider_way_payout"),
      ),
    );
  const statusesByParcelId = new Map<string, FinancialItemStatus[]>();

  for (const row of rows) {
    if (!row.parcelId || !isFinancialItemStatus(row.status)) {
      continue;
    }

    const statuses = statusesByParcelId.get(row.parcelId) ?? [];
    statuses.push(row.status);
    statusesByParcelId.set(row.parcelId, statuses);
  }

  const now = new Date();

  for (const parcelId of uniqueParcelIds) {
    await dbLike
      .update(parcels)
      .set({
        riderPayoutStatus: aggregateRiderPayoutStatus(statusesByParcelId.get(parcelId) ?? []),
        updatedAt: now,
      })
      .where(eq(parcels.id, parcelId));
  }
}

export async function generateUniqueRiderPayoutCode(dbLike: {
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
    const candidate = `RP-${datePart}-${Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, "0")}`;
    const [existingPayout] = await dbLike
      .select({ id: riderPayouts.id })
      .from(riderPayouts)
      .where(eq(riderPayouts.payoutCode, candidate))
      .limit(1);

    if (!existingPayout) {
      return candidate;
    }
  }

  throw new Error("Unable to generate a unique rider payout code.");
}
