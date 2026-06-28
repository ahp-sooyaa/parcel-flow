import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import { appUsers, bankAccounts, financialItems, parcels, riderPayouts, riders } from "@/db/schema";
import type {
  RiderPayoutEligibleRiderDto,
  RiderPayoutListItemDto,
} from "@/features/rider-payouts/server/dto";
import {
  generateUniqueRiderPayoutCode,
  recomputeParcelRiderPayoutStatuses,
} from "@/features/rider-payouts/server/utils";
import { isRiderWaySource } from "@/lib/domain";

export async function listRiderPayouts(): Promise<RiderPayoutListItemDto[]> {
  const rows = await db
    .select({
      id: riderPayouts.id,
      payoutCode: riderPayouts.payoutCode,
      riderId: riderPayouts.riderId,
      riderName: appUsers.name,
      status: riderPayouts.status,
      deliveredWayCount: riderPayouts.deliveredWayCount,
      feePerWay: riderPayouts.feePerWay,
      totalPayoutAmount: riderPayouts.totalPayoutAmount,
      paidAt: riderPayouts.paidAt,
      paymentNote: riderPayouts.paymentNote,
      createdAt: riderPayouts.createdAt,
    })
    .from(riderPayouts)
    .innerJoin(riders, eq(riders.id, riderPayouts.riderId))
    .innerJoin(appUsers, eq(appUsers.id, riders.userId))
    .orderBy(desc(riderPayouts.createdAt), desc(riderPayouts.payoutCode));

  return rows.map((row) => ({
    id: row.id,
    payoutCode: row.payoutCode,
    riderId: row.riderId,
    riderName: row.riderName,
    status: row.status === "settled" || row.status === "void" ? row.status : "in_progress",
    deliveredWayCount: row.deliveredWayCount,
    feePerWay: row.feePerWay,
    totalPayoutAmount: row.totalPayoutAmount,
    paidAt: row.paidAt?.toISOString() ?? null,
    paymentNote: row.paymentNote,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listEligibleRiderPayoutRiders(): Promise<RiderPayoutEligibleRiderDto[]> {
  const rows = await db
    .select({
      riderId: riders.id,
      riderName: appUsers.name,
      itemId: financialItems.id,
      parcelId: financialItems.parcelId,
      parcelCode: parcels.parcelCode,
      riderWaySource: financialItems.riderWaySource,
      createdAt: financialItems.createdAt,
    })
    .from(financialItems)
    .innerJoin(riders, eq(riders.id, financialItems.riderId))
    .innerJoin(appUsers, eq(appUsers.id, riders.userId))
    .leftJoin(parcels, eq(parcels.id, financialItems.parcelId))
    .where(
      and(
        eq(financialItems.itemType, "rider_way_payout"),
        eq(financialItems.status, "pending"),
        isNull(financialItems.riderPayoutId),
        eq(appUsers.isActive, true),
      ),
    )
    .orderBy(asc(appUsers.name), asc(financialItems.createdAt));
  const riderMap = new Map<string, RiderPayoutEligibleRiderDto>();

  for (const row of rows) {
    const rider =
      riderMap.get(row.riderId) ??
      ({
        riderId: row.riderId,
        riderName: row.riderName,
        eligibleItemCount: 0,
        financialItems: [],
      } satisfies RiderPayoutEligibleRiderDto);
    const riderWaySource = isRiderWaySource(row.riderWaySource)
      ? row.riderWaySource
      : "legacy_delivery";

    rider.financialItems.push({
      id: row.itemId,
      parcelId: row.parcelId,
      parcelCode: row.parcelCode,
      riderWaySource,
      status: "pending",
      createdAt: row.createdAt.toISOString(),
    });
    rider.eligibleItemCount += 1;
    riderMap.set(row.riderId, rider);
  }

  return Array.from(riderMap.values());
}

export async function createRiderPayoutDraft(input: {
  riderId: string;
  financialItemIds: string[];
  feePerWay: number;
  createdBy: string;
}) {
  const uniqueFinancialItemIds = Array.from(new Set(input.financialItemIds));

  return db.transaction(async (tx) => {
    const [rider] = await tx
      .select({
        id: riders.id,
        userId: riders.userId,
        userIsActive: appUsers.isActive,
      })
      .from(riders)
      .innerJoin(appUsers, eq(appUsers.id, riders.userId))
      .where(eq(riders.id, input.riderId))
      .limit(1);

    if (!rider?.userIsActive) {
      throw new Error("Active rider was not found.");
    }

    const selectedItems = await tx
      .select({
        id: financialItems.id,
        parcelId: financialItems.parcelId,
      })
      .from(financialItems)
      .where(
        and(
          inArray(financialItems.id, uniqueFinancialItemIds),
          eq(financialItems.riderId, input.riderId),
          eq(financialItems.itemType, "rider_way_payout"),
          eq(financialItems.status, "pending"),
          isNull(financialItems.riderPayoutId),
        ),
      )
      .for("update");

    if (selectedItems.length !== uniqueFinancialItemIds.length) {
      throw new Error("One or more selected rider way items are no longer eligible for payout.");
    }

    const payoutCode = await generateUniqueRiderPayoutCode(tx);
    const now = new Date();
    const deliveredWayCount = selectedItems.length;
    const [primaryBankAccount] = rider.userId
      ? await tx
          .select({ id: bankAccounts.id })
          .from(bankAccounts)
          .where(
            and(
              eq(bankAccounts.userId, rider.userId),
              eq(bankAccounts.isPrimary, true),
              isNull(bankAccounts.deletedAt),
            ),
          )
          .limit(1)
      : [];
    const [payout] = await tx
      .insert(riderPayouts)
      .values({
        payoutCode,
        riderId: input.riderId,
        status: "in_progress",
        deliveredWayCount,
        feePerWay: input.feePerWay,
        totalPayoutAmount: deliveredWayCount * input.feePerWay,
        bankAccountId: primaryBankAccount?.id ?? null,
        createdBy: input.createdBy,
        updatedAt: now,
      })
      .returning({
        id: riderPayouts.id,
        payoutCode: riderPayouts.payoutCode,
      });
    const reservedItems = await tx
      .update(financialItems)
      .set({
        riderPayoutId: payout.id,
        status: "in_progress",
        updatedAt: now,
      })
      .where(
        and(
          inArray(financialItems.id, uniqueFinancialItemIds),
          eq(financialItems.riderId, input.riderId),
          eq(financialItems.itemType, "rider_way_payout"),
          eq(financialItems.status, "pending"),
          isNull(financialItems.riderPayoutId),
        ),
      )
      .returning({ id: financialItems.id });

    if (reservedItems.length !== uniqueFinancialItemIds.length) {
      throw new Error("One or more selected rider way items are no longer eligible for payout.");
    }

    await recomputeParcelRiderPayoutStatuses(
      tx,
      selectedItems
        .map((item) => item.parcelId)
        .filter((parcelId): parcelId is string => parcelId !== null),
    );

    return payout;
  });
}

export async function settleRiderPayout(input: {
  payoutId: string;
  paymentNote?: string;
  paidBy: string;
}) {
  return db.transaction(async (tx) => {
    const [payout] = await tx
      .select({
        id: riderPayouts.id,
        riderId: riderPayouts.riderId,
        status: riderPayouts.status,
      })
      .from(riderPayouts)
      .where(eq(riderPayouts.id, input.payoutId))
      .limit(1)
      .for("update");

    if (!payout) {
      throw new Error("Rider payout was not found.");
    }

    if (payout.status !== "in_progress") {
      throw new Error("Only in-progress rider payouts can be settled.");
    }

    const linkedItems = await tx
      .select({
        id: financialItems.id,
        parcelId: financialItems.parcelId,
        riderId: financialItems.riderId,
        itemType: financialItems.itemType,
        status: financialItems.status,
      })
      .from(financialItems)
      .where(eq(financialItems.riderPayoutId, payout.id))
      .for("update");

    if (
      linkedItems.length === 0 ||
      linkedItems.some(
        (item) =>
          item.riderId !== payout.riderId ||
          item.itemType !== "rider_way_payout" ||
          item.status !== "in_progress",
      )
    ) {
      throw new Error("Rider payout items no longer match the in-progress payout.");
    }

    const now = new Date();
    const [updatedPayout] = await tx
      .update(riderPayouts)
      .set({
        status: "settled",
        paidBy: input.paidBy,
        paidAt: now,
        paymentNote: input.paymentNote?.trim() ? input.paymentNote.trim() : null,
        updatedAt: now,
      })
      .where(and(eq(riderPayouts.id, payout.id), eq(riderPayouts.status, "in_progress")))
      .returning({ id: riderPayouts.id });

    if (!updatedPayout) {
      throw new Error("Only in-progress rider payouts can be settled.");
    }

    const settledItems = await tx
      .update(financialItems)
      .set({
        status: "settled",
        settledAt: now,
        updatedAt: now,
      })
      .where(
        and(eq(financialItems.riderPayoutId, payout.id), eq(financialItems.status, "in_progress")),
      )
      .returning({ id: financialItems.id });

    if (settledItems.length !== linkedItems.length) {
      throw new Error("Rider payout items no longer match the in-progress payout.");
    }

    await recomputeParcelRiderPayoutStatuses(
      tx,
      linkedItems
        .map((item) => item.parcelId)
        .filter((parcelId): parcelId is string => parcelId !== null),
    );
  });
}

export async function cancelRiderPayoutDraft(input: { payoutId: string }) {
  return db.transaction(async (tx) => {
    const [payout] = await tx
      .select({
        id: riderPayouts.id,
        status: riderPayouts.status,
      })
      .from(riderPayouts)
      .where(eq(riderPayouts.id, input.payoutId))
      .limit(1)
      .for("update");

    if (!payout) {
      throw new Error("Rider payout was not found.");
    }

    if (payout.status !== "in_progress") {
      throw new Error("Only in-progress rider payouts can be canceled.");
    }

    const linkedItems = await tx
      .select({
        id: financialItems.id,
        parcelId: financialItems.parcelId,
        itemType: financialItems.itemType,
        status: financialItems.status,
      })
      .from(financialItems)
      .where(eq(financialItems.riderPayoutId, payout.id))
      .for("update");

    if (
      linkedItems.length === 0 ||
      linkedItems.some(
        (item) => item.itemType !== "rider_way_payout" || item.status !== "in_progress",
      )
    ) {
      throw new Error("Rider payout items no longer match the in-progress payout.");
    }

    const now = new Date();
    const [updatedPayout] = await tx
      .update(riderPayouts)
      .set({
        status: "void",
        updatedAt: now,
      })
      .where(and(eq(riderPayouts.id, payout.id), eq(riderPayouts.status, "in_progress")))
      .returning({ id: riderPayouts.id });

    if (!updatedPayout) {
      throw new Error("Only in-progress rider payouts can be canceled.");
    }

    const releasedItems = await tx
      .update(financialItems)
      .set({
        riderPayoutId: null,
        status: "pending",
        settledAt: null,
        updatedAt: now,
      })
      .where(
        and(eq(financialItems.riderPayoutId, payout.id), eq(financialItems.status, "in_progress")),
      )
      .returning({ id: financialItems.id });

    if (releasedItems.length !== linkedItems.length) {
      throw new Error("Rider payout items no longer match the in-progress payout.");
    }

    await recomputeParcelRiderPayoutStatuses(
      tx,
      linkedItems
        .map((item) => item.parcelId)
        .filter((parcelId): parcelId is string => parcelId !== null),
    );
  });
}
