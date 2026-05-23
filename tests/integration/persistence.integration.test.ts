import { afterEach, describe, expect, test } from "bun:test";
import { and, eq, inArray } from "drizzle-orm";

import { financialItems, merchantSettlements, parcels, parcelStatusLogs } from "@/db/schema";
import { appendActiveParcelFailureNote } from "@/features/parcels/server/failure-notes";
import { cleanupTestRecords } from "../fixtures/cleanup";
import { createTestDatabase } from "../fixtures/db";
import {
  seedTestBankAccount,
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
  bankAccountIds: [] as string[],
  settlementIds: [] as string[],
};

describe("persistence integration coverage", () => {
  const testDb = createTestDatabase();

  afterEach(async () => {
    await cleanupTestRecords(testDb.db, seededIds);
    seededIds.userIds = [];
    seededIds.merchantIds = [];
    seededIds.riderIds = [];
    seededIds.townshipIds = [];
    seededIds.parcelIds = [];
    seededIds.bankAccountIds = [];
    seededIds.settlementIds = [];
  });

  test("persists Better Auth user metadata and role-specific profiles", async () => {
    const township = await seedTestTownship(testDb.db);
    seededIds.townshipIds.push(township.id);
    const merchantSeed = await seedTestMerchant(testDb.db);
    const riderSeed = await seedTestRider(testDb.db, { townshipId: township.id });
    seededIds.userIds.push(merchantSeed.user?.id ?? "", riderSeed.user?.id ?? "");
    seededIds.merchantIds.push(merchantSeed.merchant.id);
    seededIds.riderIds.push(riderSeed.rider.id);

    const { getUserById } = await import("@/features/users/server/dal");
    const merchant = await getUserById(merchantSeed.user?.id ?? "");
    const rider = await getUserById(riderSeed.user?.id ?? "");

    expect(merchant).toMatchObject({
      role: "merchant",
      shopName: merchantSeed.merchant.shopName,
    });
    expect(rider).toMatchObject({
      role: "rider",
      serviceTownshipId: township.id,
    });
  });

  test("enforces at most one primary bank account per user", async () => {
    const user = await seedTestUser(testDb.db, { role: "super_admin" });
    seededIds.userIds.push(user.id);
    const first = await seedTestBankAccount(testDb.db, { userId: user.id, isPrimary: true });
    seededIds.bankAccountIds.push(first.bankAccount.id);

    const { createBankAccountForUser, listBankAccountsForUser } =
      await import("@/features/users/server/dal");
    const second = await createBankAccountForUser({
      userId: user.id,
      bankName: "Second Bank",
      accountHolderName: "Second Holder",
      accountNumber: `ACC-${crypto.randomUUID()}`,
      isCompanyAccount: false,
      isPrimary: true,
    });
    seededIds.bankAccountIds.push(second.id);

    const accounts = await listBankAccountsForUser(user.id);
    expect(accounts.filter((account) => account.isPrimary)).toHaveLength(1);
    expect(accounts.find((account) => account.id === second.id)?.isPrimary).toBe(true);
  });

  test("creates and updates township pricing through the DAL", async () => {
    const { createTownship, updateTownship } = await import("@/features/townships/server/dal");
    const created = await createTownship({
      name: `Integration Township ${crypto.randomUUID()}`,
      baseFee: 2_000,
      baseWeightKg: 3,
      extraWeightFee: 500,
      extraWeightUnitKg: 1,
      volumetricDivisor: 5000,
      codFeePercent: 0,
      returnFeePercent: 100,
      isActive: true,
    });
    seededIds.townshipIds.push(created.id);

    const updated = await updateTownship(created.id, {
      ...created,
      baseFee: 2_500,
      isActive: false,
    });

    expect(updated).toMatchObject({
      id: created.id,
      baseFee: 2_500,
      isActive: false,
    });
  });

  test("creates parcels with defaults and exposes role-scoped read models", async () => {
    const merchantSeed = await seedTestMerchant(testDb.db);
    const township = await seedTestTownship(testDb.db);
    const creator = await seedTestUser(testDb.db, { role: "super_admin" });
    seededIds.userIds.push(merchantSeed.user?.id ?? "", creator.id);
    seededIds.merchantIds.push(merchantSeed.merchant.id);
    seededIds.townshipIds.push(township.id);

    const { createParcel, listParcels, listParcelsForMerchantUser } =
      await import("@/features/parcels/server/dal");
    const parcel = await createParcel({
      merchantId: merchantSeed.merchant.id,
      townshipId: township.id,
      receiverName: "Receiver",
      receiverPhoneNumber: "09123456789",
      receiverAddress: "Address",
      parcelType: "cod",
      codAmount: 10_000,
      deliveryFee: 2_000,
      weightKg: 3,
      isLargeParcel: false,
      createdBy: creator.id,
    });
    seededIds.parcelIds.push(parcel.id);

    const [adminParcel] = (await listParcels()).filter((item) => item.id === parcel.id);
    const [merchantParcel] = (await listParcelsForMerchantUser(merchantSeed.user?.id ?? "")).filter(
      (item) => item.id === parcel.id,
    );

    expect(parcel).toMatchObject({
      status: "at_office",
      codStatus: "pending",
      deliveryFeeStatus: "pending",
      createdBy: creator.id,
    });
    expect(adminParcel).toMatchObject({ id: parcel.id });
    expect(merchantParcel).toMatchObject({ id: parcel.id });
  });

  test("assigns eligible parcels to an active rider and scopes rider reads", async () => {
    const parcelSeed = await seedTestParcel(testDb.db);
    const riderSeed = await seedTestRider(testDb.db);
    seededIds.parcelIds.push(parcelSeed.parcel.id);
    seededIds.userIds.push(
      parcelSeed.merchantSeed?.user?.id ?? "",
      parcelSeed.creator?.id ?? "",
      riderSeed.user?.id ?? "",
    );
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");
    seededIds.townshipIds.push(parcelSeed.township.id, riderSeed.township.id);
    seededIds.riderIds.push(riderSeed.rider.id);

    const { assignParcelsToRider, listParcelsForRiderUser } =
      await import("@/features/parcels/server/dal");
    await assignParcelsToRider({
      riderId: riderSeed.rider.id,
      parcelIds: [parcelSeed.parcel.id],
    });

    const riderParcels = await listParcelsForRiderUser(riderSeed.user?.id ?? "");

    expect(riderParcels.map((parcel) => parcel.id)).toContain(parcelSeed.parcel.id);
  });

  test("assigns postponed parcels by resetting them to at office", async () => {
    const parcelSeed = await seedTestParcel(testDb.db, { status: "postpone" });
    const riderSeed = await seedTestRider(testDb.db);
    const admin = await seedTestUser(testDb.db, { role: "office_admin" });
    seededIds.parcelIds.push(parcelSeed.parcel.id);
    seededIds.userIds.push(
      parcelSeed.merchantSeed?.user?.id ?? "",
      parcelSeed.creator?.id ?? "",
      riderSeed.user?.id ?? "",
      admin.id,
    );
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");
    seededIds.townshipIds.push(parcelSeed.township.id, riderSeed.township.id);
    seededIds.riderIds.push(riderSeed.rider.id);

    const { assignParcelsToRider } = await import("@/features/parcels/server/dal");
    await assignParcelsToRider({
      riderId: riderSeed.rider.id,
      parcelIds: [parcelSeed.parcel.id],
      actorId: admin.id,
    });

    const [updatedParcel] = await testDb.db
      .select()
      .from(parcels)
      .where(eq(parcels.id, parcelSeed.parcel.id));
    const [statusLog] = await testDb.db
      .select()
      .from(parcelStatusLogs)
      .where(eq(parcelStatusLogs.parcelId, parcelSeed.parcel.id));

    expect(updatedParcel).toMatchObject({
      status: "at_office",
      riderId: riderSeed.rider.id,
    });
    expect(updatedParcel.assignedAt).toBeInstanceOf(Date);
    expect(statusLog).toMatchObject({
      oldStatus: "postpone",
      newStatus: "at_office",
      changedBy: admin.id,
    });
  });

  test("assigns return-ready parcels without changing their status", async () => {
    const parcelSeed = await seedTestParcel(testDb.db, { status: "canceled_returned" });
    const riderSeed = await seedTestRider(testDb.db);
    seededIds.parcelIds.push(parcelSeed.parcel.id);
    seededIds.userIds.push(
      parcelSeed.merchantSeed?.user?.id ?? "",
      parcelSeed.creator?.id ?? "",
      riderSeed.user?.id ?? "",
    );
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");
    seededIds.townshipIds.push(parcelSeed.township.id, riderSeed.township.id);
    seededIds.riderIds.push(riderSeed.rider.id);

    const { assignParcelsToRider } = await import("@/features/parcels/server/dal");
    await assignParcelsToRider({
      riderId: riderSeed.rider.id,
      parcelIds: [parcelSeed.parcel.id],
    });

    const [updatedParcel] = await testDb.db
      .select()
      .from(parcels)
      .where(eq(parcels.id, parcelSeed.parcel.id));

    expect(updatedParcel).toMatchObject({
      status: "canceled_returned",
      riderId: riderSeed.rider.id,
    });
  });

  test("rejects parcel creation when the merchant does not exist", async () => {
    const township = await seedTestTownship(testDb.db);
    const creator = await seedTestUser(testDb.db, { role: "super_admin" });
    seededIds.townshipIds.push(township.id);
    seededIds.userIds.push(creator.id);

    const { createParcel } = await import("@/features/parcels/server/dal");

    await expectPromiseToRejectWith(
      createParcel({
        merchantId: crypto.randomUUID(),
        townshipId: township.id,
        receiverName: "Receiver",
        receiverPhoneNumber: "09123456789",
        receiverAddress: "Address",
        parcelType: "cod",
        codAmount: 10_000,
        deliveryFee: 2_000,
        weightKg: 3,
        isLargeParcel: false,
        createdBy: creator.id,
      }),
      "Merchant was not found.",
    );
  });

  test("rejects parcel creation when the township is inactive", async () => {
    const merchantSeed = await seedTestMerchant(testDb.db);
    const township = await seedTestTownship(testDb.db, { isActive: false });
    const creator = await seedTestUser(testDb.db, { role: "super_admin" });
    seededIds.userIds.push(merchantSeed.user?.id ?? "", creator.id);
    seededIds.merchantIds.push(merchantSeed.merchant.id);
    seededIds.townshipIds.push(township.id);

    const { createParcel } = await import("@/features/parcels/server/dal");

    await expectPromiseToRejectWith(
      createParcel({
        merchantId: merchantSeed.merchant.id,
        townshipId: township.id,
        receiverName: "Receiver",
        receiverPhoneNumber: "09123456789",
        receiverAddress: "Address",
        parcelType: "cod",
        codAmount: 10_000,
        deliveryFee: 2_000,
        weightKg: 3,
        isLargeParcel: false,
        createdBy: creator.id,
      }),
      "Active township was not found.",
    );
  });

  test("rejects parcel assignment when the rider is inactive", async () => {
    const parcelSeed = await seedTestParcel(testDb.db);
    const inactiveRiderUser = await seedTestUser(testDb.db, { role: "rider", isActive: false });
    const inactiveRiderSeed = await seedTestRider(testDb.db, { userId: inactiveRiderUser.id });
    seededIds.parcelIds.push(parcelSeed.parcel.id);
    seededIds.userIds.push(
      parcelSeed.merchantSeed?.user?.id ?? "",
      parcelSeed.creator?.id ?? "",
      inactiveRiderUser.id,
    );
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");
    seededIds.townshipIds.push(parcelSeed.township.id, inactiveRiderSeed.township.id);
    seededIds.riderIds.push(inactiveRiderSeed.rider.id);

    const { assignParcelsToRider } = await import("@/features/parcels/server/dal");

    await expectPromiseToRejectWith(
      assignParcelsToRider({
        riderId: inactiveRiderSeed.rider.id,
        parcelIds: [parcelSeed.parcel.id],
      }),
      "Active rider was not found.",
    );
  });

  test("rejects parcel assignment when any selected parcel is missing or ineligible", async () => {
    const parcelSeed = await seedTestParcel(testDb.db);
    const deliveredParcelSeed = await seedTestParcel(testDb.db, { status: "delivered" });
    const riderSeed = await seedTestRider(testDb.db);
    seededIds.parcelIds.push(parcelSeed.parcel.id, deliveredParcelSeed.parcel.id);
    seededIds.userIds.push(
      parcelSeed.merchantSeed?.user?.id ?? "",
      parcelSeed.creator?.id ?? "",
      deliveredParcelSeed.merchantSeed?.user?.id ?? "",
      deliveredParcelSeed.creator?.id ?? "",
      riderSeed.user?.id ?? "",
    );
    seededIds.merchantIds.push(
      parcelSeed.merchantSeed?.merchant.id ?? "",
      deliveredParcelSeed.merchantSeed?.merchant.id ?? "",
    );
    seededIds.townshipIds.push(
      parcelSeed.township.id,
      deliveredParcelSeed.township.id,
      riderSeed.township.id,
    );
    seededIds.riderIds.push(riderSeed.rider.id);

    const { assignParcelsToRider } = await import("@/features/parcels/server/dal");

    await expectPromiseToRejectWith(
      assignParcelsToRider({
        riderId: riderSeed.rider.id,
        parcelIds: [parcelSeed.parcel.id, crypto.randomUUID()],
      }),
      "One or more selected parcels were not found.",
    );

    await expectPromiseToRejectWith(
      assignParcelsToRider({
        riderId: riderSeed.rider.id,
        parcelIds: [deliveredParcelSeed.parcel.id],
      }),
      "Only unassigned at-office, postponed, or returned parcels can be assigned.",
    );
  });

  test("summarizes assigned active collections only", async () => {
    const { getParcelSummary } = await import("@/features/parcels/server/dal");
    const beforeSummary = await getParcelSummary();
    const firstParcelSeed = await seedTestParcel(testDb.db, {
      parcelType: "cod",
      codAmount: 10_000,
      deliveryFee: 2_000,
      status: "at_office",
    });
    const secondParcelSeed = await seedTestParcel(testDb.db, {
      parcelType: "non_cod",
      codAmount: 0,
      deliveryFee: 1_500,
      status: "on_the_way",
    });
    const deliveredParcelSeed = await seedTestParcel(testDb.db, {
      parcelType: "cod",
      codAmount: 5_000,
      deliveryFee: 1_000,
      status: "delivered",
    });
    const riderSeed = await seedTestRider(testDb.db);
    seededIds.parcelIds.push(
      firstParcelSeed.parcel.id,
      secondParcelSeed.parcel.id,
      deliveredParcelSeed.parcel.id,
    );
    seededIds.userIds.push(
      firstParcelSeed.merchantSeed?.user?.id ?? "",
      firstParcelSeed.creator?.id ?? "",
      secondParcelSeed.merchantSeed?.user?.id ?? "",
      secondParcelSeed.creator?.id ?? "",
      deliveredParcelSeed.merchantSeed?.user?.id ?? "",
      deliveredParcelSeed.creator?.id ?? "",
      riderSeed.user?.id ?? "",
    );
    seededIds.merchantIds.push(
      firstParcelSeed.merchantSeed?.merchant.id ?? "",
      secondParcelSeed.merchantSeed?.merchant.id ?? "",
      deliveredParcelSeed.merchantSeed?.merchant.id ?? "",
    );
    seededIds.townshipIds.push(
      firstParcelSeed.township.id,
      secondParcelSeed.township.id,
      deliveredParcelSeed.township.id,
      riderSeed.township.id,
    );
    seededIds.riderIds.push(riderSeed.rider.id);

    await testDb.db
      .update(parcels)
      .set({ riderId: riderSeed.rider.id })
      .where(eq(parcels.id, firstParcelSeed.parcel.id));
    await testDb.db
      .update(parcels)
      .set({ riderId: riderSeed.rider.id })
      .where(eq(parcels.id, secondParcelSeed.parcel.id));
    await testDb.db
      .update(parcels)
      .set({ riderId: riderSeed.rider.id })
      .where(eq(parcels.id, deliveredParcelSeed.parcel.id));

    const afterSummary = await getParcelSummary();

    expect(afterSummary.totalParcels - beforeSummary.totalParcels).toBe(3);
    expect(afterSummary.atOffice - beforeSummary.atOffice).toBe(1);
    expect(afterSummary.onTheWay - beforeSummary.onTheWay).toBe(1);
    expect(afterSummary.delivered - beforeSummary.delivered).toBe(1);
    expect(afterSummary.expectedCollection - beforeSummary.expectedCollection).toBe(13_500);
  });

  test("reports rider delivery failure without delivery side effects", async () => {
    const parcelSeed = await seedTestParcel(testDb.db, { status: "on_the_way" });
    const riderSeed = await seedTestRider(testDb.db);
    seededIds.parcelIds.push(parcelSeed.parcel.id);
    seededIds.userIds.push(
      parcelSeed.merchantSeed?.user?.id ?? "",
      parcelSeed.creator?.id ?? "",
      riderSeed.user?.id ?? "",
    );
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");
    seededIds.townshipIds.push(parcelSeed.township.id, riderSeed.township.id);
    seededIds.riderIds.push(riderSeed.rider.id);

    await testDb.db
      .update(parcels)
      .set({ riderId: riderSeed.rider.id })
      .where(eq(parcels.id, parcelSeed.parcel.id));

    const { reportDeliveryFailureForRiderParcel } = await import("@/features/parcels/server/dal");
    await reportDeliveryFailureForRiderParcel({
      parcelId: parcelSeed.parcel.id,
      note: "Receiver was not available.",
      riderUserId: riderSeed.user?.id ?? "",
      actorRole: "rider",
    });

    const [updatedParcel] = await testDb.db
      .select()
      .from(parcels)
      .where(eq(parcels.id, parcelSeed.parcel.id));
    const relatedFinancialItems = await testDb.db
      .select()
      .from(financialItems)
      .where(eq(financialItems.parcelId, parcelSeed.parcel.id));

    expect(updatedParcel).toMatchObject({
      status: "on_the_way",
      riderId: riderSeed.rider.id,
      deliveryFailureNote: appendActiveParcelFailureNote([], "Receiver was not available."),
      collectedAmount: 0,
    });
    expect(updatedParcel.deliveredAt).toBeNull();
    expect(relatedFinancialItems).toHaveLength(0);
  });

  test("rejects duplicate active rider failure notes for the same parcel", async () => {
    const parcelSeed = await seedTestParcel(testDb.db, { status: "on_the_way" });
    const riderSeed = await seedTestRider(testDb.db);
    seededIds.parcelIds.push(parcelSeed.parcel.id);
    seededIds.userIds.push(
      parcelSeed.merchantSeed?.user?.id ?? "",
      parcelSeed.creator?.id ?? "",
      riderSeed.user?.id ?? "",
    );
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");
    seededIds.townshipIds.push(parcelSeed.township.id, riderSeed.township.id);
    seededIds.riderIds.push(riderSeed.rider.id);

    await testDb.db
      .update(parcels)
      .set({ riderId: riderSeed.rider.id })
      .where(eq(parcels.id, parcelSeed.parcel.id));

    const { reportDeliveryFailureForRiderParcel } = await import("@/features/parcels/server/dal");

    await reportDeliveryFailureForRiderParcel({
      parcelId: parcelSeed.parcel.id,
      note: "Receiver was not available.",
      riderUserId: riderSeed.user?.id ?? "",
      actorRole: "rider",
    });

    await expectPromiseToRejectWith(
      reportDeliveryFailureForRiderParcel({
        parcelId: parcelSeed.parcel.id,
        note: "Receiver asked for tomorrow.",
        riderUserId: riderSeed.user?.id ?? "",
        actorRole: "rider",
      }),
      "This parcel already has an active failure note.",
    );
  });

  test("admin postpones failed parcel and clears rider assignment without financial side effects", async () => {
    const parcelSeed = await seedTestParcel(testDb.db, {
      status: "on_the_way",
      deliveryFailureNote: "Receiver asked to deliver tomorrow.",
      parcelType: "cod",
      codAmount: 10_000,
      deliveryFee: 2_000,
    });
    const riderSeed = await seedTestRider(testDb.db);
    const admin = await seedTestUser(testDb.db, { role: "office_admin" });
    seededIds.parcelIds.push(parcelSeed.parcel.id);
    seededIds.userIds.push(
      parcelSeed.merchantSeed?.user?.id ?? "",
      parcelSeed.creator?.id ?? "",
      riderSeed.user?.id ?? "",
      admin.id,
    );
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");
    seededIds.townshipIds.push(parcelSeed.township.id, riderSeed.township.id);
    seededIds.riderIds.push(riderSeed.rider.id);

    await testDb.db
      .update(parcels)
      .set({ riderId: riderSeed.rider.id, assignedAt: new Date() })
      .where(eq(parcels.id, parcelSeed.parcel.id));

    const { getParcelSummary, resolveFailedParcelByAdmin } =
      await import("@/features/parcels/server/dal");
    const beforeSummary = await getParcelSummary();

    await resolveFailedParcelByAdmin({
      parcelId: parcelSeed.parcel.id,
      targetStatus: "postpone",
      actorId: admin.id,
      actorRole: "office_admin",
    });

    const afterSummary = await getParcelSummary();
    const [updatedParcel] = await testDb.db
      .select()
      .from(parcels)
      .where(eq(parcels.id, parcelSeed.parcel.id));
    const relatedFinancialItems = await testDb.db
      .select()
      .from(financialItems)
      .where(eq(financialItems.parcelId, parcelSeed.parcel.id));
    const [statusLog] = await testDb.db
      .select()
      .from(parcelStatusLogs)
      .where(eq(parcelStatusLogs.parcelId, parcelSeed.parcel.id));

    expect(updatedParcel).toMatchObject({
      deliveryFailureNote: [
        {
          note: "Receiver asked to deliver tomorrow.",
          status: "inactive",
        },
      ],
      status: "postpone",
      riderId: null,
      assignedAt: null,
      collectedAmount: 0,
    });
    expect(afterSummary.expectedCollection - beforeSummary.expectedCollection).toBe(-12_000);
    expect(relatedFinancialItems).toHaveLength(0);
    expect(statusLog).toMatchObject({
      oldStatus: "on_the_way",
      newStatus: "postpone",
      changedBy: admin.id,
    });
  });

  test("admin marks failed parcel for merchant return and rejects stale failure decisions", async () => {
    const parcelSeed = await seedTestParcel(testDb.db, {
      status: "on_the_way",
      deliveryFailureNote: "Receiver refused the parcel.",
    });
    const riderSeed = await seedTestRider(testDb.db);
    const admin = await seedTestUser(testDb.db, { role: "super_admin" });
    seededIds.parcelIds.push(parcelSeed.parcel.id);
    seededIds.userIds.push(
      parcelSeed.merchantSeed?.user?.id ?? "",
      parcelSeed.creator?.id ?? "",
      riderSeed.user?.id ?? "",
      admin.id,
    );
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");
    seededIds.townshipIds.push(parcelSeed.township.id, riderSeed.township.id);
    seededIds.riderIds.push(riderSeed.rider.id);

    await testDb.db
      .update(parcels)
      .set({ riderId: riderSeed.rider.id, assignedAt: new Date() })
      .where(eq(parcels.id, parcelSeed.parcel.id));

    const { resolveFailedParcelByAdmin } = await import("@/features/parcels/server/dal");

    await resolveFailedParcelByAdmin({
      parcelId: parcelSeed.parcel.id,
      targetStatus: "canceled_returned",
      actorId: admin.id,
      actorRole: "super_admin",
    });

    await expectPromiseToRejectWith(
      resolveFailedParcelByAdmin({
        parcelId: parcelSeed.parcel.id,
        targetStatus: "postpone",
        actorId: admin.id,
        actorRole: "super_admin",
      }),
      "Only on-the-way failed parcels can be resolved.",
    );

    const [updatedParcel] = await testDb.db
      .select()
      .from(parcels)
      .where(eq(parcels.id, parcelSeed.parcel.id));
    const relatedFinancialItems = await testDb.db
      .select()
      .from(financialItems)
      .where(eq(financialItems.parcelId, parcelSeed.parcel.id));

    expect(updatedParcel).toMatchObject({
      deliveryFailureNote: [
        {
          note: "Receiver refused the parcel.",
          status: "inactive",
        },
      ],
      status: "canceled_returned",
      riderId: null,
      assignedAt: null,
    });
    expect(relatedFinancialItems).toHaveLength(0);
  });

  test("rejects delivery failure reports for unrelated or non-on-the-way parcels", async () => {
    const parcelSeed = await seedTestParcel(testDb.db, { status: "at_office" });
    const assignedRiderSeed = await seedTestRider(testDb.db);
    const otherRiderSeed = await seedTestRider(testDb.db);
    seededIds.parcelIds.push(parcelSeed.parcel.id);
    seededIds.userIds.push(
      parcelSeed.merchantSeed?.user?.id ?? "",
      parcelSeed.creator?.id ?? "",
      assignedRiderSeed.user?.id ?? "",
      otherRiderSeed.user?.id ?? "",
    );
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");
    seededIds.townshipIds.push(
      parcelSeed.township.id,
      assignedRiderSeed.township.id,
      otherRiderSeed.township.id,
    );
    seededIds.riderIds.push(assignedRiderSeed.rider.id, otherRiderSeed.rider.id);

    await testDb.db
      .update(parcels)
      .set({ riderId: assignedRiderSeed.rider.id })
      .where(eq(parcels.id, parcelSeed.parcel.id));

    const { reportDeliveryFailureForRiderParcel } = await import("@/features/parcels/server/dal");

    await expectPromiseToRejectWith(
      reportDeliveryFailureForRiderParcel({
        parcelId: parcelSeed.parcel.id,
        note: "Receiver was not available.",
        riderUserId: otherRiderSeed.user?.id ?? "",
        actorRole: "rider",
      }),
      "You can only report failure for parcels assigned to your rider account.",
    );

    await expectPromiseToRejectWith(
      reportDeliveryFailureForRiderParcel({
        parcelId: parcelSeed.parcel.id,
        note: "Receiver was not available.",
        riderUserId: assignedRiderSeed.user?.id ?? "",
        actorRole: "rider",
      }),
      "Only on-the-way parcels can be reported as failed.",
    );
  });

  test("marks COD rider parcel delivered and creates settlement and payout items", async () => {
    const parcelSeed = await seedTestParcel(testDb.db, {
      status: "on_the_way",
      parcelType: "cod",
      codAmount: 10_000,
      deliveryFee: 2_000,
    });
    const riderSeed = await seedTestRider(testDb.db);
    seededIds.parcelIds.push(parcelSeed.parcel.id);
    seededIds.userIds.push(
      parcelSeed.merchantSeed?.user?.id ?? "",
      parcelSeed.creator?.id ?? "",
      riderSeed.user?.id ?? "",
    );
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");
    seededIds.townshipIds.push(parcelSeed.township.id, riderSeed.township.id);
    seededIds.riderIds.push(riderSeed.rider.id);

    await testDb.db
      .update(parcels)
      .set({ riderId: riderSeed.rider.id })
      .where(eq(parcels.id, parcelSeed.parcel.id));

    const { markRiderParcelDelivered } = await import("@/features/parcels/server/dal");
    await markRiderParcelDelivered({
      parcelId: parcelSeed.parcel.id,
      proofImageKey: "parcels/proof.jpg",
      riderUserId: riderSeed.user?.id ?? "",
      actorRole: "rider",
      createdBy: riderSeed.user?.id ?? "",
    });

    const [updatedParcel] = await testDb.db
      .select()
      .from(parcels)
      .where(eq(parcels.id, parcelSeed.parcel.id));
    const items = await testDb.db
      .select()
      .from(financialItems)
      .where(eq(financialItems.parcelId, parcelSeed.parcel.id));

    expect(updatedParcel).toMatchObject({
      status: "delivered",
      codStatus: "collected",
      deliveryFeeStatus: "collected",
      isReceivedByOffice: false,
      collectedAmount: 12_000,
      merchantSettlementStatus: "pending",
      riderPayoutStatus: "pending",
      proofOfDeliveryImagesKeys: ["parcels/proof.jpg"],
    });
    expect(updatedParcel.deliveredAt).toBeInstanceOf(Date);
    expect(updatedParcel.collectedAt).toBeInstanceOf(Date);
    expect(items).toHaveLength(2);
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemType: "cod_remit",
          amount: 10_000,
          status: "pending",
          merchantId: parcelSeed.merchantSeed?.merchant.id,
          parcelId: parcelSeed.parcel.id,
        }),
        expect.objectContaining({
          itemType: "rider_way_payout",
          amount: 1,
          status: "pending",
          merchantId: parcelSeed.merchantSeed?.merchant.id,
          riderId: riderSeed.rider.id,
          parcelId: parcelSeed.parcel.id,
        }),
      ]),
    );
  });

  test("creates and resolves merchant settlements from eligible financial items", async () => {
    const merchantSeed = await seedTestMerchant(testDb.db);
    const creator = await seedTestUser(testDb.db, { role: "super_admin" });
    const bankAccount = await seedTestBankAccount(testDb.db, {
      userId: merchantSeed.user?.id,
      isPrimary: true,
    });
    const codParcelSeed = await seedTestParcel(testDb.db, {
      merchantId: merchantSeed.merchant.id,
      createdBy: creator.id,
      status: "delivered",
      parcelType: "cod",
      codAmount: 25_000,
      deliveryFee: 2_000,
    });
    const returnParcelSeed = await seedTestParcel(testDb.db, {
      merchantId: merchantSeed.merchant.id,
      createdBy: creator.id,
      status: "returned_to_merchant",
      parcelType: "cod",
      codAmount: 8_000,
      deliveryFee: 2_500,
    });
    seededIds.userIds.push(merchantSeed.user?.id ?? "", creator.id);
    seededIds.merchantIds.push(merchantSeed.merchant.id);
    seededIds.bankAccountIds.push(bankAccount.bankAccount.id);
    seededIds.townshipIds.push(codParcelSeed.township.id, returnParcelSeed.township.id);
    seededIds.parcelIds.push(codParcelSeed.parcel.id, returnParcelSeed.parcel.id);

    const [codItem, deductionItem] = await testDb.db
      .insert(financialItems)
      .values([
        {
          parcelId: codParcelSeed.parcel.id,
          merchantId: merchantSeed.merchant.id,
          itemType: "cod_remit",
          amount: 25_000,
          status: "pending",
          createdBy: creator.id,
        },
        {
          parcelId: returnParcelSeed.parcel.id,
          merchantId: merchantSeed.merchant.id,
          itemType: "delivery_fee_deduction",
          amount: 2_500,
          status: "pending",
          createdBy: creator.id,
        },
      ])
      .returning();

    const { createMerchantSettlement, resolveMerchantSettlement } =
      await import("@/features/settlements/server/dal");
    const createdSettlement = await createMerchantSettlement({
      merchantId: merchantSeed.merchant.id,
      financialItemIds: [codItem.id, deductionItem.id],
      createdBy: creator.id,
    });
    seededIds.settlementIds.push(createdSettlement.id);

    const [pendingSettlement] = await testDb.db
      .select()
      .from(merchantSettlements)
      .where(eq(merchantSettlements.id, createdSettlement.id));
    const reservedItems = await testDb.db
      .select()
      .from(financialItems)
      .where(eq(financialItems.merchantSettlementId, createdSettlement.id));

    expect(pendingSettlement).toMatchObject({
      id: createdSettlement.id,
      status: "pending",
      bankAccountId: bankAccount.bankAccount.id,
      totalCodAmount: 25_000,
      totalDeliveryFeeDeduction: 2_500,
      netPaymentAmount: 22_500,
    });
    expect(reservedItems).toHaveLength(2);
    expect(reservedItems.every((item) => item.status === "in_progress")).toBe(true);

    await resolveMerchantSettlement({
      settlementId: createdSettlement.id,
      bankTransferReceiptKey: "settlements/test/receipt.pdf",
      paymentNote: "KBZ transfer 5512",
      paidBy: creator.id,
    });

    const [settledSettlement] = await testDb.db
      .select()
      .from(merchantSettlements)
      .where(eq(merchantSettlements.id, createdSettlement.id));
    const settledItems = await testDb.db
      .select()
      .from(financialItems)
      .where(eq(financialItems.merchantSettlementId, createdSettlement.id));
    const settledParcels = await testDb.db
      .select({
        id: parcels.id,
        merchantSettlementStatus: parcels.merchantSettlementStatus,
      })
      .from(parcels)
      .where(and(eq(parcels.merchantId, merchantSeed.merchant.id), inArray(parcels.id, [codParcelSeed.parcel.id, returnParcelSeed.parcel.id])));

    expect(settledSettlement).toMatchObject({
      status: "settled",
      paidBy: creator.id,
      bankTransferReceiptKey: "settlements/test/receipt.pdf",
      paymentNote: "KBZ transfer 5512",
    });
    expect(settledSettlement.paidAt).toBeInstanceOf(Date);
    expect(settledSettlement.bankTransferReceiptUploadedAt).toBeInstanceOf(Date);
    expect(settledItems.every((item) => item.status === "settled")).toBe(true);
    expect(settledItems.every((item) => item.settledAt instanceof Date)).toBe(true);
    expect(settledParcels.every((parcel) => parcel.merchantSettlementStatus === "settled")).toBe(
      true,
    );
  });

  test("rejects merchant settlement creation when deductions exceed selected COD", async () => {
    const merchantSeed = await seedTestMerchant(testDb.db);
    const creator = await seedTestUser(testDb.db, { role: "super_admin" });
    const returnParcelSeed = await seedTestParcel(testDb.db, {
      merchantId: merchantSeed.merchant.id,
      createdBy: creator.id,
      status: "returned_to_merchant",
      parcelType: "cod",
      codAmount: 8_000,
      deliveryFee: 2_500,
    });
    seededIds.userIds.push(merchantSeed.user?.id ?? "", creator.id);
    seededIds.merchantIds.push(merchantSeed.merchant.id);
    seededIds.townshipIds.push(returnParcelSeed.township.id);
    seededIds.parcelIds.push(returnParcelSeed.parcel.id);

    const [deductionItem] = await testDb.db
      .insert(financialItems)
      .values({
        parcelId: returnParcelSeed.parcel.id,
        merchantId: merchantSeed.merchant.id,
        itemType: "delivery_fee_deduction",
        amount: 2_500,
        status: "pending",
        createdBy: creator.id,
      })
      .returning();

    const { createMerchantSettlement } = await import("@/features/settlements/server/dal");

    await expectPromiseToRejectWith(
      createMerchantSettlement({
        merchantId: merchantSeed.merchant.id,
        financialItemIds: [deductionItem.id],
        createdBy: creator.id,
      }),
      "Delivery fee deductions exceed the selected COD total.",
    );

    const settlements = await testDb.db.select().from(merchantSettlements);
    const [unchangedItem] = await testDb.db
      .select()
      .from(financialItems)
      .where(eq(financialItems.id, deductionItem.id));

    expect(settlements).toHaveLength(0);
    expect(unchangedItem).toMatchObject({
      status: "pending",
      merchantSettlementId: null,
    });
  });

  test("marks non-COD rider parcel delivered and creates only payout item", async () => {
    const parcelSeed = await seedTestParcel(testDb.db, {
      status: "on_the_way",
      parcelType: "non_cod",
      codAmount: 0,
      deliveryFee: 1_500,
    });
    const riderSeed = await seedTestRider(testDb.db);
    seededIds.parcelIds.push(parcelSeed.parcel.id);
    seededIds.userIds.push(
      parcelSeed.merchantSeed?.user?.id ?? "",
      parcelSeed.creator?.id ?? "",
      riderSeed.user?.id ?? "",
    );
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");
    seededIds.townshipIds.push(parcelSeed.township.id, riderSeed.township.id);
    seededIds.riderIds.push(riderSeed.rider.id);

    await testDb.db
      .update(parcels)
      .set({ riderId: riderSeed.rider.id })
      .where(eq(parcels.id, parcelSeed.parcel.id));

    const { markRiderParcelDelivered } = await import("@/features/parcels/server/dal");
    await markRiderParcelDelivered({
      parcelId: parcelSeed.parcel.id,
      proofImageKey: "parcels/non-cod-proof.jpg",
      riderUserId: riderSeed.user?.id ?? "",
      actorRole: "rider",
      createdBy: riderSeed.user?.id ?? "",
    });

    const [updatedParcel] = await testDb.db
      .select()
      .from(parcels)
      .where(eq(parcels.id, parcelSeed.parcel.id));
    const items = await testDb.db
      .select()
      .from(financialItems)
      .where(eq(financialItems.parcelId, parcelSeed.parcel.id));

    expect(updatedParcel).toMatchObject({
      status: "delivered",
      codStatus: "not_applicable",
      deliveryFeeStatus: "collected",
      collectedAmount: 1_500,
      riderPayoutStatus: "pending",
      proofOfDeliveryImagesKeys: ["parcels/non-cod-proof.jpg"],
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      itemType: "rider_way_payout",
      amount: 1,
      status: "pending",
      riderId: riderSeed.rider.id,
      parcelId: parcelSeed.parcel.id,
    });
  });

  test("rejects mark delivered for inactive, unrelated, missing, or non-on-the-way parcels", async () => {
    const parcelSeed = await seedTestParcel(testDb.db, { status: "at_office" });
    const assignedRiderSeed = await seedTestRider(testDb.db);
    const otherRiderSeed = await seedTestRider(testDb.db);
    const inactiveRiderUser = await seedTestUser(testDb.db, { role: "rider", isActive: false });
    const inactiveRiderSeed = await seedTestRider(testDb.db, { userId: inactiveRiderUser.id });
    seededIds.parcelIds.push(parcelSeed.parcel.id);
    seededIds.userIds.push(
      parcelSeed.merchantSeed?.user?.id ?? "",
      parcelSeed.creator?.id ?? "",
      assignedRiderSeed.user?.id ?? "",
      otherRiderSeed.user?.id ?? "",
      inactiveRiderUser.id,
    );
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");
    seededIds.townshipIds.push(
      parcelSeed.township.id,
      assignedRiderSeed.township.id,
      otherRiderSeed.township.id,
      inactiveRiderSeed.township.id,
    );
    seededIds.riderIds.push(
      assignedRiderSeed.rider.id,
      otherRiderSeed.rider.id,
      inactiveRiderSeed.rider.id,
    );

    await testDb.db
      .update(parcels)
      .set({ riderId: assignedRiderSeed.rider.id })
      .where(eq(parcels.id, parcelSeed.parcel.id));

    const { markRiderParcelDelivered } = await import("@/features/parcels/server/dal");

    await expectPromiseToRejectWith(
      markRiderParcelDelivered({
        parcelId: parcelSeed.parcel.id,
        proofImageKey: "parcels/proof.jpg",
        riderUserId: inactiveRiderUser.id,
        actorRole: "rider",
        createdBy: inactiveRiderUser.id,
      }),
      "Active rider profile was not found.",
    );

    await expectPromiseToRejectWith(
      markRiderParcelDelivered({
        parcelId: parcelSeed.parcel.id,
        proofImageKey: "parcels/proof.jpg",
        riderUserId: otherRiderSeed.user?.id ?? "",
        actorRole: "rider",
        createdBy: otherRiderSeed.user?.id ?? "",
      }),
      "You can only mark parcels assigned to your rider account delivered.",
    );

    await expectPromiseToRejectWith(
      markRiderParcelDelivered({
        parcelId: crypto.randomUUID(),
        proofImageKey: "parcels/proof.jpg",
        riderUserId: assignedRiderSeed.user?.id ?? "",
        actorRole: "rider",
        createdBy: assignedRiderSeed.user?.id ?? "",
      }),
      "Parcel was not found.",
    );

    await expectPromiseToRejectWith(
      markRiderParcelDelivered({
        parcelId: parcelSeed.parcel.id,
        proofImageKey: "parcels/proof.jpg",
        riderUserId: assignedRiderSeed.user?.id ?? "",
        actorRole: "rider",
        createdBy: assignedRiderSeed.user?.id ?? "",
      }),
      "Only on-the-way parcels can be marked delivered.",
    );

    const relatedFinancialItems = await testDb.db
      .select()
      .from(financialItems)
      .where(
        and(
          eq(financialItems.parcelId, parcelSeed.parcel.id),
          eq(financialItems.status, "pending"),
        ),
    );
    expect(relatedFinancialItems).toHaveLength(0);
  });

  test("marks canceled-returned parcel returned to merchant and creates deduction item", async () => {
    const parcelSeed = await seedTestParcel(testDb.db, {
      status: "canceled_returned",
      parcelType: "cod",
      codAmount: 10_000,
      deliveryFee: 2_000,
    });
    const riderSeed = await seedTestRider(testDb.db);
    seededIds.parcelIds.push(parcelSeed.parcel.id);
    seededIds.userIds.push(
      parcelSeed.merchantSeed?.user?.id ?? "",
      parcelSeed.creator?.id ?? "",
      riderSeed.user?.id ?? "",
    );
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");
    seededIds.townshipIds.push(parcelSeed.township.id, riderSeed.township.id);
    seededIds.riderIds.push(riderSeed.rider.id);

    await testDb.db
      .update(parcels)
      .set({ riderId: riderSeed.rider.id })
      .where(eq(parcels.id, parcelSeed.parcel.id));

    const { markRiderParcelReturnedToMerchant } = await import("@/features/parcels/server/dal");
    await markRiderParcelReturnedToMerchant({
      parcelId: parcelSeed.parcel.id,
      riderUserId: riderSeed.user?.id ?? "",
      actorRole: "rider",
      createdBy: riderSeed.user?.id ?? "",
    });

    const [updatedParcel] = await testDb.db
      .select()
      .from(parcels)
      .where(eq(parcels.id, parcelSeed.parcel.id));
    const items = await testDb.db
      .select()
      .from(financialItems)
      .where(eq(financialItems.parcelId, parcelSeed.parcel.id));

    expect(updatedParcel).toMatchObject({
      status: "returned_to_merchant",
      riderId: riderSeed.rider.id,
      deliveryFeeStatus: "deduct_from_merchant",
      merchantSettlementStatus: "pending",
    });
    expect(updatedParcel.returnedToMerchantAt).toBeInstanceOf(Date);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      itemType: "delivery_fee_deduction",
      amount: 2_000,
      status: "pending",
      merchantId: parcelSeed.merchantSeed?.merchant.id,
      riderId: null,
      parcelId: parcelSeed.parcel.id,
    });
  });

  test("rejects return completion for inactive, unrelated, missing, or non-canceled-returned parcels", async () => {
    const parcelSeed = await seedTestParcel(testDb.db, { status: "at_office" });
    const assignedRiderSeed = await seedTestRider(testDb.db);
    const otherRiderSeed = await seedTestRider(testDb.db);
    const inactiveRiderUser = await seedTestUser(testDb.db, { role: "rider", isActive: false });
    const inactiveRiderSeed = await seedTestRider(testDb.db, { userId: inactiveRiderUser.id });
    seededIds.parcelIds.push(parcelSeed.parcel.id);
    seededIds.userIds.push(
      parcelSeed.merchantSeed?.user?.id ?? "",
      parcelSeed.creator?.id ?? "",
      assignedRiderSeed.user?.id ?? "",
      otherRiderSeed.user?.id ?? "",
      inactiveRiderUser.id,
    );
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");
    seededIds.townshipIds.push(
      parcelSeed.township.id,
      assignedRiderSeed.township.id,
      otherRiderSeed.township.id,
      inactiveRiderSeed.township.id,
    );
    seededIds.riderIds.push(
      assignedRiderSeed.rider.id,
      otherRiderSeed.rider.id,
      inactiveRiderSeed.rider.id,
    );

    await testDb.db
      .update(parcels)
      .set({ riderId: assignedRiderSeed.rider.id })
      .where(eq(parcels.id, parcelSeed.parcel.id));

    const { markRiderParcelReturnedToMerchant } = await import("@/features/parcels/server/dal");

    await expectPromiseToRejectWith(
      markRiderParcelReturnedToMerchant({
        parcelId: parcelSeed.parcel.id,
        riderUserId: inactiveRiderUser.id,
        actorRole: "rider",
        createdBy: inactiveRiderUser.id,
      }),
      "Active rider profile was not found.",
    );

    await expectPromiseToRejectWith(
      markRiderParcelReturnedToMerchant({
        parcelId: parcelSeed.parcel.id,
        riderUserId: otherRiderSeed.user?.id ?? "",
        actorRole: "rider",
        createdBy: otherRiderSeed.user?.id ?? "",
      }),
      "You can only complete merchant returns for parcels assigned to your rider account.",
    );

    await expectPromiseToRejectWith(
      markRiderParcelReturnedToMerchant({
        parcelId: crypto.randomUUID(),
        riderUserId: assignedRiderSeed.user?.id ?? "",
        actorRole: "rider",
        createdBy: assignedRiderSeed.user?.id ?? "",
      }),
      "Parcel was not found.",
    );

    await expectPromiseToRejectWith(
      markRiderParcelReturnedToMerchant({
        parcelId: parcelSeed.parcel.id,
        riderUserId: assignedRiderSeed.user?.id ?? "",
        actorRole: "rider",
        createdBy: assignedRiderSeed.user?.id ?? "",
      }),
      "Only canceled-returned parcels can be completed as returned.",
    );

    const relatedFinancialItems = await testDb.db
      .select()
      .from(financialItems)
      .where(
        and(
          eq(financialItems.parcelId, parcelSeed.parcel.id),
          eq(financialItems.status, "pending"),
        ),
      );
    expect(relatedFinancialItems).toHaveLength(0);
  });

  test("updates user profiles across rider-specific branches", async () => {
    const townshipA = await seedTestTownship(testDb.db, { name: uniqueTownshipName("A") });
    const townshipB = await seedTestTownship(testDb.db, { name: uniqueTownshipName("B") });
    const user = await seedTestUser(testDb.db, { role: "merchant" });
    const firstPhoneNumber = uniquePhoneNumber();
    const secondPhoneNumber = uniquePhoneNumber();
    seededIds.townshipIds.push(townshipA.id, townshipB.id);
    seededIds.userIds.push(user.id);

    const { getUserById, updateUserProfile } = await import("@/features/users/server/dal");
    const promotedUser = await updateUserProfile({
      id: user.id,
      name: "Promoted Rider",
      phoneNumber: firstPhoneNumber,
      address: "Rider address",
      age: 28,
      role: "rider",
      isActive: true,
      serviceTownshipId: townshipA.id,
    });

    const updatedUser = await updateUserProfile({
      id: user.id,
      name: "Promoted Rider",
      phoneNumber: secondPhoneNumber,
      address: "Rider address",
      age: 28,
      role: "rider",
      isActive: true,
      serviceTownshipId: townshipB.id,
    });
    const riderRow = await testDb.db.query.riders.findFirst({
      where: (riders, { eq: equals }) => equals(riders.userId, user.id),
    });

    if (riderRow) {
      seededIds.riderIds.push(riderRow.id);
    }

    expect(promotedUser).toMatchObject({
      role: "rider",
      serviceTownshipId: townshipA.id,
      serviceTownshipName: townshipA.name,
    });
    expect(updatedUser).toMatchObject({
      role: "rider",
      serviceTownshipId: townshipB.id,
      serviceTownshipName: townshipB.name,
    });
    expect(await getUserById(user.id)).toMatchObject({
      serviceTownshipId: townshipB.id,
    });
  });
});

function uniqueTownshipName(suffix: string) {
  return `Integration Township ${suffix} ${crypto.randomUUID()}`;
}

function uniquePhoneNumber() {
  return `09${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
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
