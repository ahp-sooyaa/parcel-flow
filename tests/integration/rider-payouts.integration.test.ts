import { afterEach, describe, expect, test } from "bun:test";
import { eq, inArray } from "drizzle-orm";

import { financialItems, parcels, riderPayouts } from "@/db/schema";
import { cleanupTestRecords } from "../fixtures/cleanup";
import { createTestDatabase } from "../fixtures/db";
import {
  seedTestMerchant,
  seedTestParcel,
  seedTestRider,
  seedTestTownship,
  seedTestUser,
} from "../fixtures/seed";

const seededIds = {
  userIds: [] as string[],
  merchantIds: [] as string[],
  riderIds: [] as string[],
  townshipIds: [] as string[],
  parcelIds: [] as string[],
  riderPayoutIds: [] as string[],
};

describe("rider payout lifecycle integration", () => {
  const testDb = createTestDatabase();

  afterEach(async () => {
    await cleanupTestRecords(testDb.db, seededIds);
    seededIds.userIds = [];
    seededIds.merchantIds = [];
    seededIds.riderIds = [];
    seededIds.townshipIds = [];
    seededIds.parcelIds = [];
    seededIds.riderPayoutIds = [];
  });

  test("preserves failed attempts, credits retries, and credits return work to its rider", async () => {
    const admin = await seedTestUser(testDb.db, { role: "office_admin" });
    const firstRider = await seedTestRider(testDb.db);
    const retryRider = await seedTestRider(testDb.db);
    const returnRider = await seedTestRider(testDb.db);
    const parcelSeed = await seedTestParcel(testDb.db, { status: "at_office" });
    trackUserIds(
      admin.id,
      firstRider.user?.id,
      retryRider.user?.id,
      returnRider.user?.id,
      parcelSeed.merchantSeed?.user?.id,
      parcelSeed.creator?.id,
    );
    seededIds.riderIds.push(firstRider.rider.id, retryRider.rider.id, returnRider.rider.id);
    seededIds.townshipIds.push(
      firstRider.township.id,
      retryRider.township.id,
      returnRider.township.id,
      parcelSeed.township.id,
    );
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");
    seededIds.parcelIds.push(parcelSeed.parcel.id);

    const {
      assignParcelsToRider,
      markRiderParcelReturnedToMerchant,
      reportDeliveryFailureForRiderParcel,
      resolveFailedParcelByAdmin,
      startDeliveryForRiderParcels,
    } = await import("@/features/parcels/server/dal");

    await assignParcelsToRider({
      parcelIds: [parcelSeed.parcel.id],
      riderId: firstRider.rider.id,
      actorId: admin.id,
    });
    await startDeliveryForRiderParcels({
      parcelIds: [parcelSeed.parcel.id],
      riderUserId: firstRider.user?.id ?? "",
      actorRole: "rider",
    });
    await reportDeliveryFailureForRiderParcel({
      parcelId: parcelSeed.parcel.id,
      note: "Receiver requested another day.",
      riderUserId: firstRider.user?.id ?? "",
      actorRole: "rider",
    });
    await resolveFailedParcelByAdmin({
      parcelId: parcelSeed.parcel.id,
      targetStatus: "postpone",
      actorId: admin.id,
      actorRole: "office_admin",
    });

    await assignParcelsToRider({
      parcelIds: [parcelSeed.parcel.id],
      riderId: retryRider.rider.id,
      actorId: admin.id,
    });
    await startDeliveryForRiderParcels({
      parcelIds: [parcelSeed.parcel.id],
      riderUserId: retryRider.user?.id ?? "",
      actorRole: "rider",
    });
    await reportDeliveryFailureForRiderParcel({
      parcelId: parcelSeed.parcel.id,
      note: "Receiver refused the parcel.",
      riderUserId: retryRider.user?.id ?? "",
      actorRole: "rider",
    });
    await resolveFailedParcelByAdmin({
      parcelId: parcelSeed.parcel.id,
      targetStatus: "canceled_returned",
      actorId: admin.id,
      actorRole: "office_admin",
    });

    await assignParcelsToRider({
      parcelIds: [parcelSeed.parcel.id],
      riderId: returnRider.rider.id,
      actorId: admin.id,
    });
    await markRiderParcelReturnedToMerchant({
      parcelId: parcelSeed.parcel.id,
      riderUserId: returnRider.user?.id ?? "",
      actorRole: "rider",
      createdBy: returnRider.user?.id ?? "",
    });

    const items = await testDb.db
      .select()
      .from(financialItems)
      .where(eq(financialItems.parcelId, parcelSeed.parcel.id));
    const wayItems = items.filter((item) => item.itemType === "rider_way_payout");

    expect(wayItems).toHaveLength(3);
    expect(wayItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          riderId: firstRider.rider.id,
          riderWaySource: "delivery_attempt",
          status: "pending",
        }),
        expect.objectContaining({
          riderId: retryRider.rider.id,
          riderWaySource: "delivery_attempt",
          status: "pending",
        }),
        expect.objectContaining({
          riderId: returnRider.rider.id,
          riderWaySource: "merchant_return",
          status: "pending",
        }),
      ]),
    );
    expect(items.filter((item) => item.itemType === "delivery_fee_deduction")).toHaveLength(1);
  });

  test("status correction preserves attempt credit and voids only return-completion items", async () => {
    const attemptRider = await seedTestRider(testDb.db);
    const returnRider = await seedTestRider(testDb.db);
    const admin = await seedTestUser(testDb.db, { role: "super_admin" });
    const parcelSeed = await seedTestParcel(testDb.db, {
      riderId: returnRider.rider.id,
      status: "returned_to_merchant",
      assignedAt: new Date(),
      returnedToMerchantAt: new Date(),
      deliveryFeeStatus: "deduct_from_merchant",
    });
    trackUserIds(
      attemptRider.user?.id,
      returnRider.user?.id,
      admin.id,
      parcelSeed.merchantSeed?.user?.id,
      parcelSeed.creator?.id,
    );
    seededIds.riderIds.push(attemptRider.rider.id, returnRider.rider.id);
    seededIds.townshipIds.push(
      attemptRider.township.id,
      returnRider.township.id,
      parcelSeed.township.id,
    );
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");
    seededIds.parcelIds.push(parcelSeed.parcel.id);

    await testDb.db.insert(financialItems).values([
      {
        parcelId: parcelSeed.parcel.id,
        merchantId: parcelSeed.parcel.merchantId,
        riderId: attemptRider.rider.id,
        itemType: "rider_way_payout",
        riderWaySource: "delivery_attempt",
        amount: 1,
        status: "pending",
        createdBy: admin.id,
      },
      {
        parcelId: parcelSeed.parcel.id,
        merchantId: parcelSeed.parcel.merchantId,
        riderId: returnRider.rider.id,
        itemType: "rider_way_payout",
        riderWaySource: "merchant_return",
        amount: 1,
        status: "pending",
        createdBy: admin.id,
      },
      {
        parcelId: parcelSeed.parcel.id,
        merchantId: parcelSeed.parcel.merchantId,
        riderId: null,
        itemType: "delivery_fee_deduction",
        amount: parcelSeed.parcel.deliveryFee,
        status: "pending",
        createdBy: admin.id,
      },
    ]);

    const { correctParcelStatus, listParcels } = await import("@/features/parcels/server/dal");
    const reviewedParcel = (await listParcels()).find(
      (parcel) => parcel.id === parcelSeed.parcel.id,
    );

    if (!reviewedParcel) {
      throw new Error("Parcel was not found for correction.");
    }

    await correctParcelStatus({
      parcelId: parcelSeed.parcel.id,
      expectedStatus: reviewedParcel.status,
      expectedRiderId: reviewedParcel.riderId,
      expectedFinancialItemsFingerprint: reviewedParcel.correctionStateToken,
      targetStatus: "on_the_way",
      targetRiderId: returnRider.rider.id,
      reason: "Return completion was recorded on the wrong parcel.",
      actorId: admin.id,
      actorRole: "super_admin",
    });

    const items = await testDb.db
      .select()
      .from(financialItems)
      .where(eq(financialItems.parcelId, parcelSeed.parcel.id));

    expect(items.find((item) => item.riderWaySource === "delivery_attempt")).toMatchObject({
      riderId: attemptRider.rider.id,
      status: "pending",
    });
    expect(items.find((item) => item.riderWaySource === "merchant_return")).toMatchObject({
      riderId: returnRider.rider.id,
      status: "void",
    });
    expect(items.find((item) => item.itemType === "delivery_fee_deduction")).toMatchObject({
      status: "void",
    });
  });

  test("creates, rejects stale reuse, cancels, and settles rider payouts", async () => {
    const admin = await seedTestUser(testDb.db, { role: "super_admin" });
    const riderSeed = await seedTestRider(testDb.db);
    const merchantSeed = await seedTestMerchant(testDb.db);
    const township = await seedTestTownship(testDb.db);
    const firstParcel = await seedTestParcel(testDb.db, {
      merchantId: merchantSeed.merchant.id,
      townshipId: township.id,
      createdBy: admin.id,
    });
    const secondParcel = await seedTestParcel(testDb.db, {
      merchantId: merchantSeed.merchant.id,
      townshipId: township.id,
      createdBy: admin.id,
    });
    trackUserIds(admin.id, riderSeed.user?.id, merchantSeed.user?.id);
    seededIds.riderIds.push(riderSeed.rider.id);
    seededIds.townshipIds.push(riderSeed.township.id, township.id);
    seededIds.merchantIds.push(merchantSeed.merchant.id);
    seededIds.parcelIds.push(firstParcel.parcel.id, secondParcel.parcel.id);

    const createdItems = await testDb.db
      .insert(financialItems)
      .values(
        [firstParcel.parcel, secondParcel.parcel].map((parcel) => ({
          parcelId: parcel.id,
          merchantId: parcel.merchantId,
          riderId: riderSeed.rider.id,
          itemType: "rider_way_payout",
          riderWaySource: "delivery_attempt",
          amount: 1,
          status: "pending",
          createdBy: admin.id,
        })),
      )
      .returning();
    const itemIds = createdItems.map((item) => item.id);
    const {
      cancelRiderPayoutDraft,
      createRiderPayoutDraft,
      listEligibleRiderPayoutRiders,
      settleRiderPayout,
    } = await import("@/features/rider-payouts/server/dal");

    const eligibleRiders = await listEligibleRiderPayoutRiders();
    expect(eligibleRiders.find((rider) => rider.riderId === riderSeed.rider.id)).toMatchObject({
      eligibleItemCount: 2,
    });

    const firstPayout = await createRiderPayoutDraft({
      riderId: riderSeed.rider.id,
      financialItemIds: itemIds,
      feePerWay: 900,
      createdBy: admin.id,
    });
    seededIds.riderPayoutIds.push(firstPayout.id);

    await expectPromiseToRejectWith(
      createRiderPayoutDraft({
        riderId: riderSeed.rider.id,
        financialItemIds: itemIds,
        feePerWay: 900,
        createdBy: admin.id,
      }),
      "One or more selected rider way items are no longer eligible for payout.",
    );

    const [createdPayout] = await testDb.db
      .select()
      .from(riderPayouts)
      .where(eq(riderPayouts.id, firstPayout.id));
    expect(createdPayout).toMatchObject({
      deliveredWayCount: 2,
      feePerWay: 900,
      totalPayoutAmount: 1_800,
      status: "in_progress",
    });

    await cancelRiderPayoutDraft({ payoutId: firstPayout.id });
    const releasedItems = await testDb.db
      .select()
      .from(financialItems)
      .where(inArray(financialItems.id, itemIds));
    expect(releasedItems.every((item) => item.status === "pending")).toBe(true);
    expect(releasedItems.every((item) => item.riderPayoutId === null)).toBe(true);

    const secondPayout = await createRiderPayoutDraft({
      riderId: riderSeed.rider.id,
      financialItemIds: itemIds,
      feePerWay: 1_000,
      createdBy: admin.id,
    });
    seededIds.riderPayoutIds.push(secondPayout.id);
    await settleRiderPayout({
      payoutId: secondPayout.id,
      paidBy: admin.id,
      paymentNote: "Bank transfer complete.",
    });

    const settledItems = await testDb.db
      .select()
      .from(financialItems)
      .where(inArray(financialItems.id, itemIds));
    const affectedParcels = await testDb.db
      .select()
      .from(parcels)
      .where(inArray(parcels.id, [firstParcel.parcel.id, secondParcel.parcel.id]));

    expect(settledItems.every((item) => item.status === "settled")).toBe(true);
    expect(settledItems.every((item) => item.settledAt instanceof Date)).toBe(true);
    expect(affectedParcels.every((parcel) => parcel.riderPayoutStatus === "settled")).toBe(true);
  });
});

function trackUserIds(...userIds: Array<string | undefined>) {
  seededIds.userIds.push(...userIds.filter((userId): userId is string => Boolean(userId)));
}

async function expectPromiseToRejectWith(promise: Promise<unknown>, message: string) {
  try {
    await promise;
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error;
    }

    expect(error.message).toBe(message);
    return;
  }

  throw new Error(`Expected promise to reject with: ${message}`);
}
