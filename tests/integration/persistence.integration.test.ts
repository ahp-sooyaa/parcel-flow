import { afterEach, describe, expect, test } from "bun:test";
import { and, eq, inArray } from "drizzle-orm";

import {
  financialItems,
  merchantSettlements,
  parcels,
  parcelCorrectionLogs,
  parcelStatusLogs,
} from "@/db/schema";
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

  test("marks COD rider parcel delivered and preserves the start-delivery payout item", async () => {
    const parcelSeed = await seedTestParcel(testDb.db, {
      status: "at_office",
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

    const { listEligibleSettlementMerchants, listPendingRiderCashHandovers } =
      await import("@/features/settlements/server/dal");
    const { markRiderParcelDelivered, startDeliveryForRiderParcels } =
      await import("@/features/parcels/server/dal");
    await startDeliveryForRiderParcels({
      parcelIds: [parcelSeed.parcel.id],
      riderUserId: riderSeed.user?.id ?? "",
      actorRole: "rider",
    });
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
    const riderHandovers = await listPendingRiderCashHandovers();
    const eligibleMerchants = await listEligibleSettlementMerchants();

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
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      itemType: "rider_way_payout",
      riderWaySource: "delivery_attempt",
      amount: 1,
      status: "pending",
      merchantId: parcelSeed.merchantSeed?.merchant.id,
      riderId: riderSeed.rider.id,
      parcelId: parcelSeed.parcel.id,
    });
    expect(riderHandovers.find((handover) => handover.riderId === riderSeed.rider.id)).toEqual(
      expect.objectContaining({
        riderId: riderSeed.rider.id,
        riderName: riderSeed.user?.name,
        pendingParcelCount: 1,
        totalCodAmount: 10_000,
        totalDeliveryFeeAmount: 2_000,
        totalCollectedAmount: 12_000,
      }),
    );
    expect(
      eligibleMerchants.filter(
        (merchant) => merchant.merchantId === parcelSeed.merchantSeed?.merchant.id,
      ),
    ).toHaveLength(0);
  });

  test("merchant overview counts COD as collected only after office receipt confirmation", async () => {
    const merchantSeed = await seedTestMerchant(testDb.db);
    seededIds.userIds.push(merchantSeed.user?.id ?? "");
    seededIds.merchantIds.push(merchantSeed.merchant.id);

    const receivedCodParcel = await seedTestParcel(testDb.db, {
      merchantId: merchantSeed.merchant.id,
      status: "delivered",
      parcelType: "cod",
      codAmount: 10_000,
      isReceivedByOffice: true,
    });
    const unreceivedCodParcel = await seedTestParcel(testDb.db, {
      merchantId: merchantSeed.merchant.id,
      status: "delivered",
      parcelType: "cod",
      codAmount: 8_000,
      isReceivedByOffice: false,
    });
    const nonCodParcel = await seedTestParcel(testDb.db, {
      merchantId: merchantSeed.merchant.id,
      status: "delivered",
      parcelType: "non_cod",
      codAmount: 0,
      isReceivedByOffice: true,
    });

    seededIds.parcelIds.push(
      receivedCodParcel.parcel.id,
      unreceivedCodParcel.parcel.id,
      nonCodParcel.parcel.id,
    );
    seededIds.userIds.push(
      receivedCodParcel.creator?.id ?? "",
      unreceivedCodParcel.creator?.id ?? "",
      nonCodParcel.creator?.id ?? "",
    );
    seededIds.townshipIds.push(
      receivedCodParcel.township.id,
      unreceivedCodParcel.township.id,
      nonCodParcel.township.id,
    );

    const { getMerchantOverviewSummary } = await import("@/features/merchants/server/dal");
    const summary = await getMerchantOverviewSummary(merchantSeed.user?.id ?? "");

    expect(summary.totalCodCollected).toBe(10_000);
    expect(summary.deliveredParcels).toBe(3);
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
      .where(
        and(
          eq(parcels.merchantId, merchantSeed.merchant.id),
          inArray(parcels.id, [codParcelSeed.parcel.id, returnParcelSeed.parcel.id]),
        ),
      );

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

    const settlements = await testDb.db
      .select()
      .from(merchantSettlements)
      .where(eq(merchantSettlements.merchantId, merchantSeed.merchant.id));
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

  test("marks non-COD rider parcel delivered and preserves the start-delivery payout item", async () => {
    const parcelSeed = await seedTestParcel(testDb.db, {
      status: "at_office",
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

    const { markRiderParcelDelivered, startDeliveryForRiderParcels } =
      await import("@/features/parcels/server/dal");
    await startDeliveryForRiderParcels({
      parcelIds: [parcelSeed.parcel.id],
      riderUserId: riderSeed.user?.id ?? "",
      actorRole: "rider",
    });
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
      riderWaySource: "delivery_attempt",
      amount: 1,
      status: "pending",
      riderId: riderSeed.rider.id,
      parcelId: parcelSeed.parcel.id,
    });
  });

  test("confirms rider cash handover atomically and creates deferred COD remit only for COD parcels", async () => {
    const creator = await seedTestUser(testDb.db, { role: "super_admin" });
    const riderSeed = await seedTestRider(testDb.db);
    const codParcelSeed = await seedTestParcel(testDb.db, {
      status: "delivered",
      parcelType: "cod",
      codAmount: 15_000,
      deliveryFee: 2_000,
      riderId: riderSeed.rider.id,
      isReceivedByOffice: false,
      collectedAmount: 17_000,
      deliveredAt: new Date(),
    });
    const nonCodParcelSeed = await seedTestParcel(testDb.db, {
      status: "delivered",
      parcelType: "non_cod",
      codAmount: 0,
      deliveryFee: 1_500,
      riderId: riderSeed.rider.id,
      isReceivedByOffice: false,
      collectedAmount: 1_500,
      deliveredAt: new Date(),
    });
    seededIds.userIds.push(
      creator.id,
      riderSeed.user?.id ?? "",
      codParcelSeed.merchantSeed?.user?.id ?? "",
      codParcelSeed.creator?.id ?? "",
      nonCodParcelSeed.merchantSeed?.user?.id ?? "",
      nonCodParcelSeed.creator?.id ?? "",
    );
    seededIds.merchantIds.push(
      codParcelSeed.merchantSeed?.merchant.id ?? "",
      nonCodParcelSeed.merchantSeed?.merchant.id ?? "",
    );
    seededIds.townshipIds.push(
      riderSeed.township.id,
      codParcelSeed.township.id,
      nonCodParcelSeed.township.id,
    );
    seededIds.riderIds.push(riderSeed.rider.id);
    seededIds.parcelIds.push(codParcelSeed.parcel.id, nonCodParcelSeed.parcel.id);

    const [codPayoutItem, nonCodPayoutItem] = await testDb.db
      .insert(financialItems)
      .values([
        {
          parcelId: codParcelSeed.parcel.id,
          merchantId: codParcelSeed.parcel.merchantId,
          riderId: riderSeed.rider.id,
          itemType: "rider_way_payout",
          amount: 1,
          status: "pending",
          createdBy: riderSeed.user?.id ?? "",
        },
        {
          parcelId: nonCodParcelSeed.parcel.id,
          merchantId: nonCodParcelSeed.parcel.merchantId,
          riderId: riderSeed.rider.id,
          itemType: "rider_way_payout",
          amount: 1,
          status: "pending",
          createdBy: riderSeed.user?.id ?? "",
        },
      ])
      .returning();

    const {
      confirmRiderCashHandover,
      listEligibleSettlementMerchants,
      listPendingRiderCashHandovers,
    } = await import("@/features/settlements/server/dal");
    const result = await confirmRiderCashHandover({
      riderId: riderSeed.rider.id,
      parcelIds: [codParcelSeed.parcel.id, nonCodParcelSeed.parcel.id],
      confirmedBy: creator.id,
    });

    const confirmedParcels = await testDb.db
      .select({
        id: parcels.id,
        isReceivedByOffice: parcels.isReceivedByOffice,
        collectionConfirmedBy: parcels.collectionConfirmedBy,
      })
      .from(parcels)
      .where(inArray(parcels.id, [codParcelSeed.parcel.id, nonCodParcelSeed.parcel.id]));
    const linkedItems = await testDb.db
      .select()
      .from(financialItems)
      .where(inArray(financialItems.id, [codPayoutItem.id, nonCodPayoutItem.id]))
      .then((items) => items);
    const codRemitItems = await testDb.db
      .select()
      .from(financialItems)
      .where(
        and(
          eq(financialItems.parcelId, codParcelSeed.parcel.id),
          eq(financialItems.itemType, "cod_remit"),
        ),
      );
    const nonCodRemitItems = await testDb.db
      .select()
      .from(financialItems)
      .where(
        and(
          eq(financialItems.parcelId, nonCodParcelSeed.parcel.id),
          eq(financialItems.itemType, "cod_remit"),
        ),
      );
    const remainingHandovers = await listPendingRiderCashHandovers();
    const eligibleMerchants = await listEligibleSettlementMerchants();

    expect(result).toEqual({
      confirmedParcelCount: 2,
      createdCodRemitCount: 1,
    });
    expect(confirmedParcels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: codParcelSeed.parcel.id,
          isReceivedByOffice: true,
          collectionConfirmedBy: creator.id,
        }),
        expect.objectContaining({
          id: nonCodParcelSeed.parcel.id,
          isReceivedByOffice: true,
          collectionConfirmedBy: creator.id,
        }),
      ]),
    );
    expect(linkedItems).toHaveLength(2);
    expect(codRemitItems).toHaveLength(1);
    expect(codRemitItems[0]).toMatchObject({
      itemType: "cod_remit",
      amount: 15_000,
      merchantId: codParcelSeed.parcel.merchantId,
      parcelId: codParcelSeed.parcel.id,
      createdBy: creator.id,
      status: "pending",
    });
    expect(nonCodRemitItems).toHaveLength(0);
    expect(
      remainingHandovers.find((handover) => handover.riderId === riderSeed.rider.id),
    ).toBeUndefined();
    expect(
      eligibleMerchants.find((merchant) => merchant.merchantId === codParcelSeed.parcel.merchantId),
    ).toEqual(
      expect.objectContaining({
        merchantId: codParcelSeed.parcel.merchantId,
        eligibleItemCount: 1,
        totalCodAmount: 15_000,
        totalDeliveryFeeDeduction: 0,
        netPaymentAmount: 15_000,
      }),
    );
  });

  test("rejects stale or mixed-rider handover selections without partial updates", async () => {
    const creator = await seedTestUser(testDb.db, { role: "super_admin" });
    const firstRiderSeed = await seedTestRider(testDb.db);
    const secondRiderSeed = await seedTestRider(testDb.db);
    const firstParcelSeed = await seedTestParcel(testDb.db, {
      status: "delivered",
      riderId: firstRiderSeed.rider.id,
      isReceivedByOffice: false,
      collectedAmount: 12_000,
      deliveredAt: new Date(),
    });
    const secondParcelSeed = await seedTestParcel(testDb.db, {
      status: "delivered",
      riderId: secondRiderSeed.rider.id,
      isReceivedByOffice: false,
      collectedAmount: 9_000,
      deliveredAt: new Date(),
    });
    seededIds.userIds.push(
      creator.id,
      firstRiderSeed.user?.id ?? "",
      secondRiderSeed.user?.id ?? "",
      firstParcelSeed.merchantSeed?.user?.id ?? "",
      firstParcelSeed.creator?.id ?? "",
      secondParcelSeed.merchantSeed?.user?.id ?? "",
      secondParcelSeed.creator?.id ?? "",
    );
    seededIds.merchantIds.push(
      firstParcelSeed.parcel.merchantId,
      secondParcelSeed.parcel.merchantId,
    );
    seededIds.townshipIds.push(
      firstRiderSeed.township.id,
      secondRiderSeed.township.id,
      firstParcelSeed.township.id,
      secondParcelSeed.township.id,
    );
    seededIds.riderIds.push(firstRiderSeed.rider.id, secondRiderSeed.rider.id);
    seededIds.parcelIds.push(firstParcelSeed.parcel.id, secondParcelSeed.parcel.id);

    const { confirmRiderCashHandover } = await import("@/features/settlements/server/dal");

    await expectPromiseToRejectWith(
      confirmRiderCashHandover({
        riderId: firstRiderSeed.rider.id,
        parcelIds: [firstParcelSeed.parcel.id, secondParcelSeed.parcel.id],
        confirmedBy: creator.id,
      }),
      "One or more selected parcels are no longer eligible for handover.",
    );

    const updatedParcels = await testDb.db
      .select({
        id: parcels.id,
        isReceivedByOffice: parcels.isReceivedByOffice,
        collectionConfirmedBy: parcels.collectionConfirmedBy,
      })
      .from(parcels)
      .where(inArray(parcels.id, [firstParcelSeed.parcel.id, secondParcelSeed.parcel.id]));
    const createdCodRemitItems = await testDb.db
      .select()
      .from(financialItems)
      .where(
        and(
          inArray(financialItems.parcelId, [firstParcelSeed.parcel.id, secondParcelSeed.parcel.id]),
          eq(financialItems.itemType, "cod_remit"),
        ),
      );

    expect(updatedParcels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: firstParcelSeed.parcel.id,
          isReceivedByOffice: false,
          collectionConfirmedBy: null,
        }),
        expect.objectContaining({
          id: secondParcelSeed.parcel.id,
          isReceivedByOffice: false,
          collectionConfirmedBy: null,
        }),
      ]),
    );
    expect(createdCodRemitItems).toHaveLength(0);
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

  test("marks canceled-returned parcel returned and creates deduction and return-way items", async () => {
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
    expect(items).toHaveLength(2);
    expect(items.find((item) => item.itemType === "delivery_fee_deduction")).toMatchObject({
      itemType: "delivery_fee_deduction",
      amount: 2_000,
      status: "pending",
      merchantId: parcelSeed.merchantSeed?.merchant.id,
      riderId: null,
      parcelId: parcelSeed.parcel.id,
    });
    expect(items.find((item) => item.itemType === "rider_way_payout")).toMatchObject({
      itemType: "rider_way_payout",
      riderWaySource: "merchant_return",
      amount: 1,
      status: "pending",
      riderId: riderSeed.rider.id,
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

  test("corrects delivered parcels away from delivered and voids pending financial side effects", async () => {
    const riderSeed = await seedTestRider(testDb.db);
    const admin = await seedTestUser(testDb.db, { role: "office_admin" });
    const parcelSeed = await seedTestParcel(testDb.db, {
      riderId: riderSeed.rider.id,
      status: "delivered",
      assignedAt: new Date(),
      deliveredAt: new Date(),
      collectedAt: new Date(),
      collectedAmount: 12_000,
      codStatus: "collected",
      deliveryFeeStatus: "collected",
      isReceivedByOffice: true,
      collectionConfirmedBy: admin.id,
      proofOfDeliveryImagesKeys: ["proof-key"],
    });
    seededIds.parcelIds.push(parcelSeed.parcel.id);
    seededIds.userIds.push(
      riderSeed.user?.id ?? "",
      admin.id,
      parcelSeed.merchantSeed?.user?.id ?? "",
      parcelSeed.creator?.id ?? "",
    );
    seededIds.riderIds.push(riderSeed.rider.id);
    seededIds.townshipIds.push(riderSeed.township.id, parcelSeed.township.id);
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");

    await testDb.db.insert(financialItems).values([
      {
        parcelId: parcelSeed.parcel.id,
        merchantId: parcelSeed.parcel.merchantId,
        riderId: riderSeed.rider.id,
        itemType: "rider_way_payout",
        riderWaySource: "delivery_attempt",
        amount: 1,
        status: "pending",
        createdBy: admin.id,
      },
      {
        parcelId: parcelSeed.parcel.id,
        merchantId: parcelSeed.parcel.merchantId,
        riderId: null,
        itemType: "cod_remit",
        amount: parcelSeed.parcel.codAmount,
        status: "pending",
        createdBy: admin.id,
      },
    ]);

    const { correctParcelStatus } = await import("@/features/parcels/server/dal");
    await correctParcelStatus({
      parcelId: parcelSeed.parcel.id,
      ...(await getParcelCorrectionExpectation(parcelSeed.parcel.id)),
      targetStatus: "at_office",
      targetRiderId: null,
      reason: "Marked delivered by mistake.",
      actorId: admin.id,
      actorRole: "office_admin",
    });

    const [updatedParcel] = await testDb.db
      .select()
      .from(parcels)
      .where(eq(parcels.id, parcelSeed.parcel.id));
    const relatedItems = await testDb.db
      .select()
      .from(financialItems)
      .where(eq(financialItems.parcelId, parcelSeed.parcel.id));
    const [statusLog] = await testDb.db
      .select()
      .from(parcelStatusLogs)
      .where(eq(parcelStatusLogs.parcelId, parcelSeed.parcel.id));
    const [correctionLog] = await testDb.db
      .select()
      .from(parcelCorrectionLogs)
      .where(eq(parcelCorrectionLogs.parcelId, parcelSeed.parcel.id));

    expect(updatedParcel).toMatchObject({
      status: "at_office",
      riderId: null,
      collectedAmount: 0,
      codStatus: "pending",
      deliveryFeeStatus: "pending",
      isReceivedByOffice: false,
      collectionConfirmedBy: null,
    });
    expect(updatedParcel.deliveredAt).toBeNull();
    expect(updatedParcel.collectedAt).toBeNull();
    expect(updatedParcel.proofOfDeliveryImagesKeys).toEqual([]);
    expect(relatedItems.find((item) => item.itemType === "rider_way_payout")).toMatchObject({
      status: "pending",
      riderWaySource: "delivery_attempt",
    });
    expect(relatedItems.find((item) => item.itemType === "cod_remit")).toMatchObject({
      status: "void",
    });
    expect(statusLog).toMatchObject({ oldStatus: "delivered", newStatus: "at_office" });
    expect(correctionLog).toMatchObject({
      correctionType: "status",
      oldStatus: "delivered",
      newStatus: "at_office",
      statusLogId: statusLog.id,
      reason: "Marked delivered by mistake.",
    });
  });

  test("corrects delivered parcels to each non-delivered target status", async () => {
    const riderSeed = await seedTestRider(testDb.db);
    const admin = await seedTestUser(testDb.db, { role: "office_admin" });
    seededIds.userIds.push(riderSeed.user?.id ?? "", admin.id);
    seededIds.riderIds.push(riderSeed.rider.id);
    seededIds.townshipIds.push(riderSeed.township.id);

    const targets = [
      { status: "on_the_way" as const, targetRiderId: riderSeed.rider.id },
      { status: "at_office" as const, targetRiderId: null },
      { status: "postpone" as const, targetRiderId: null },
      { status: "canceled_returned" as const, targetRiderId: null },
    ];
    const { correctParcelStatus } = await import("@/features/parcels/server/dal");

    for (const target of targets) {
      const parcelSeed = await seedTestParcel(testDb.db, {
        riderId: riderSeed.rider.id,
        status: "delivered",
        assignedAt: new Date(),
        deliveredAt: new Date(),
        collectedAt: new Date(),
        collectedAmount: 12_000,
        codStatus: "collected",
        deliveryFeeStatus: "collected",
        proofOfDeliveryImagesKeys: ["proof-key"],
      });
      seededIds.parcelIds.push(parcelSeed.parcel.id);
      seededIds.userIds.push(parcelSeed.merchantSeed?.user?.id ?? "", parcelSeed.creator?.id ?? "");
      seededIds.townshipIds.push(parcelSeed.township.id);
      seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");

      await testDb.db.insert(financialItems).values({
        parcelId: parcelSeed.parcel.id,
        merchantId: parcelSeed.parcel.merchantId,
        riderId: riderSeed.rider.id,
        itemType: "rider_way_payout",
        riderWaySource: "delivery_attempt",
        amount: 1,
        status: "pending",
        createdBy: admin.id,
      });

      await correctParcelStatus({
        parcelId: parcelSeed.parcel.id,
        ...(await getParcelCorrectionExpectation(parcelSeed.parcel.id)),
        targetStatus: target.status,
        targetRiderId: target.targetRiderId,
        reason: `Correct delivered to ${target.status}.`,
        actorId: admin.id,
        actorRole: "office_admin",
      });

      const [updatedParcel] = await testDb.db
        .select()
        .from(parcels)
        .where(eq(parcels.id, parcelSeed.parcel.id));
      const relatedItems = await testDb.db
        .select()
        .from(financialItems)
        .where(eq(financialItems.parcelId, parcelSeed.parcel.id));

      expect(updatedParcel.status).toBe(target.status);
      expect(updatedParcel.deliveredAt).toBeNull();
      expect(relatedItems).toEqual([
        expect.objectContaining({
          itemType: "rider_way_payout",
          riderWaySource: "delivery_attempt",
          status: "pending",
        }),
      ]);
    }
  });

  test("corrects returned parcels away from returned-to-merchant and voids pending deductions", async () => {
    const riderSeed = await seedTestRider(testDb.db);
    const admin = await seedTestUser(testDb.db, { role: "super_admin" });
    const parcelSeed = await seedTestParcel(testDb.db, {
      riderId: riderSeed.rider.id,
      status: "returned_to_merchant",
      assignedAt: new Date(),
      returnedToMerchantAt: new Date(),
      deliveryFeeStatus: "deduct_from_merchant",
    });
    seededIds.parcelIds.push(parcelSeed.parcel.id);
    seededIds.userIds.push(
      riderSeed.user?.id ?? "",
      admin.id,
      parcelSeed.merchantSeed?.user?.id ?? "",
      parcelSeed.creator?.id ?? "",
    );
    seededIds.riderIds.push(riderSeed.rider.id);
    seededIds.townshipIds.push(riderSeed.township.id, parcelSeed.township.id);
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");

    await testDb.db.insert(financialItems).values({
      parcelId: parcelSeed.parcel.id,
      merchantId: parcelSeed.parcel.merchantId,
      riderId: null,
      itemType: "delivery_fee_deduction",
      amount: parcelSeed.parcel.deliveryFee,
      status: "pending",
      createdBy: admin.id,
    });

    const { correctParcelStatus } = await import("@/features/parcels/server/dal");
    await correctParcelStatus({
      parcelId: parcelSeed.parcel.id,
      ...(await getParcelCorrectionExpectation(parcelSeed.parcel.id)),
      targetStatus: "on_the_way",
      targetRiderId: riderSeed.rider.id,
      reason: "Return was completed on the wrong parcel.",
      actorId: admin.id,
      actorRole: "super_admin",
    });

    const [updatedParcel] = await testDb.db
      .select()
      .from(parcels)
      .where(eq(parcels.id, parcelSeed.parcel.id));
    const [deductionItem] = await testDb.db
      .select()
      .from(financialItems)
      .where(eq(financialItems.parcelId, parcelSeed.parcel.id));

    expect(updatedParcel).toMatchObject({
      status: "on_the_way",
      riderId: riderSeed.rider.id,
      deliveryFeeStatus: "pending",
    });
    expect(updatedParcel.returnedToMerchantAt).toBeNull();
    expect(deductionItem).toMatchObject({ itemType: "delivery_fee_deduction", status: "void" });
  });

  test("corrects parcels to delivered without duplicating rider payout items", async () => {
    const riderSeed = await seedTestRider(testDb.db);
    const admin = await seedTestUser(testDb.db, { role: "super_admin" });
    const parcelSeed = await seedTestParcel(testDb.db, {
      riderId: null,
      status: "postpone",
      assignedAt: null,
    });
    seededIds.parcelIds.push(parcelSeed.parcel.id);
    seededIds.userIds.push(
      riderSeed.user?.id ?? "",
      admin.id,
      parcelSeed.merchantSeed?.user?.id ?? "",
      parcelSeed.creator?.id ?? "",
    );
    seededIds.riderIds.push(riderSeed.rider.id);
    seededIds.townshipIds.push(riderSeed.township.id, parcelSeed.township.id);
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");

    await testDb.db.insert(financialItems).values({
      parcelId: parcelSeed.parcel.id,
      merchantId: parcelSeed.parcel.merchantId,
      riderId: riderSeed.rider.id,
      itemType: "rider_way_payout",
      riderWaySource: "delivery_attempt",
      amount: 1,
      status: "pending",
      createdBy: admin.id,
    });

    const { correctParcelStatus } = await import("@/features/parcels/server/dal");
    await correctParcelStatus({
      parcelId: parcelSeed.parcel.id,
      ...(await getParcelCorrectionExpectation(parcelSeed.parcel.id)),
      targetStatus: "delivered",
      targetRiderId: riderSeed.rider.id,
      proofImageKey: "proof-key",
      reason: "Delivered status was missed.",
      actorId: admin.id,
      actorRole: "super_admin",
    });

    const relatedItems = await testDb.db
      .select()
      .from(financialItems)
      .where(eq(financialItems.parcelId, parcelSeed.parcel.id));
    const [updatedParcel] = await testDb.db
      .select()
      .from(parcels)
      .where(eq(parcels.id, parcelSeed.parcel.id));

    expect(updatedParcel).toMatchObject({
      status: "delivered",
      collectedAmount: 12_000,
      codStatus: "collected",
      deliveryFeeStatus: "collected",
    });
    expect(updatedParcel.proofOfDeliveryImagesKeys).toEqual(["proof-key"]);
    expect(relatedItems).toEqual([
      expect.objectContaining({
        itemType: "rider_way_payout",
        riderWaySource: "delivery_attempt",
        riderId: riderSeed.rider.id,
        status: "pending",
      }),
    ]);
  });

  test("corrects parcels to delivered using legacy delivery attempt items", async () => {
    const riderSeed = await seedTestRider(testDb.db);
    const admin = await seedTestUser(testDb.db, { role: "super_admin" });
    const parcelSeed = await seedTestParcel(testDb.db, {
      riderId: null,
      status: "postpone",
      assignedAt: null,
    });
    seededIds.parcelIds.push(parcelSeed.parcel.id);
    seededIds.userIds.push(
      riderSeed.user?.id ?? "",
      admin.id,
      parcelSeed.merchantSeed?.user?.id ?? "",
      parcelSeed.creator?.id ?? "",
    );
    seededIds.riderIds.push(riderSeed.rider.id);
    seededIds.townshipIds.push(riderSeed.township.id, parcelSeed.township.id);
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");

    await testDb.db.insert(financialItems).values({
      parcelId: parcelSeed.parcel.id,
      merchantId: parcelSeed.parcel.merchantId,
      riderId: riderSeed.rider.id,
      itemType: "rider_way_payout",
      riderWaySource: "legacy_delivery",
      amount: 1,
      status: "pending",
      createdBy: admin.id,
    });

    const { correctParcelStatus } = await import("@/features/parcels/server/dal");
    await correctParcelStatus({
      parcelId: parcelSeed.parcel.id,
      ...(await getParcelCorrectionExpectation(parcelSeed.parcel.id)),
      targetStatus: "delivered",
      targetRiderId: riderSeed.rider.id,
      proofImageKey: "proof-key",
      reason: "Delivered status was missed on a migrated payout item.",
      actorId: admin.id,
      actorRole: "super_admin",
    });

    const [updatedParcel] = await testDb.db
      .select()
      .from(parcels)
      .where(eq(parcels.id, parcelSeed.parcel.id));
    const relatedItems = await testDb.db
      .select()
      .from(financialItems)
      .where(eq(financialItems.parcelId, parcelSeed.parcel.id));

    expect(updatedParcel).toMatchObject({
      status: "delivered",
      collectedAmount: 12_000,
      codStatus: "collected",
      deliveryFeeStatus: "collected",
    });
    expect(relatedItems).toEqual([
      expect.objectContaining({
        itemType: "rider_way_payout",
        riderWaySource: "legacy_delivery",
        riderId: riderSeed.rider.id,
        status: "pending",
      }),
    ]);
  });

  test("corrects only the latest delivery attempt rider when status is corrected to delivered", async () => {
    const historicalRiderSeed = await seedTestRider(testDb.db);
    const incorrectRiderSeed = await seedTestRider(testDb.db);
    const correctedRiderSeed = await seedTestRider(testDb.db);
    const admin = await seedTestUser(testDb.db, { role: "super_admin" });
    const parcelSeed = await seedTestParcel(testDb.db, {
      riderId: null,
      status: "postpone",
      assignedAt: null,
    });
    seededIds.parcelIds.push(parcelSeed.parcel.id);
    seededIds.userIds.push(
      historicalRiderSeed.user?.id ?? "",
      incorrectRiderSeed.user?.id ?? "",
      correctedRiderSeed.user?.id ?? "",
      admin.id,
      parcelSeed.merchantSeed?.user?.id ?? "",
      parcelSeed.creator?.id ?? "",
    );
    seededIds.riderIds.push(
      historicalRiderSeed.rider.id,
      incorrectRiderSeed.rider.id,
      correctedRiderSeed.rider.id,
    );
    seededIds.townshipIds.push(
      historicalRiderSeed.township.id,
      incorrectRiderSeed.township.id,
      correctedRiderSeed.township.id,
      parcelSeed.township.id,
    );
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");

    const [historicalAttempt, latestAttempt] = await testDb.db
      .insert(financialItems)
      .values([
        {
          parcelId: parcelSeed.parcel.id,
          merchantId: parcelSeed.parcel.merchantId,
          riderId: historicalRiderSeed.rider.id,
          itemType: "rider_way_payout",
          riderWaySource: "delivery_attempt",
          amount: 1,
          status: "pending",
          createdBy: admin.id,
          createdAt: new Date("2026-06-13T00:00:00.000Z"),
        },
        {
          parcelId: parcelSeed.parcel.id,
          merchantId: parcelSeed.parcel.merchantId,
          riderId: incorrectRiderSeed.rider.id,
          itemType: "rider_way_payout",
          riderWaySource: "delivery_attempt",
          amount: 1,
          status: "pending",
          createdBy: admin.id,
          createdAt: new Date("2026-06-14T00:00:00.000Z"),
        },
      ])
      .returning();

    const { correctParcelStatus } = await import("@/features/parcels/server/dal");
    await correctParcelStatus({
      parcelId: parcelSeed.parcel.id,
      ...(await getParcelCorrectionExpectation(parcelSeed.parcel.id)),
      targetStatus: "delivered",
      targetRiderId: correctedRiderSeed.rider.id,
      proofImageKey: "proof-key",
      reason: "The latest attempt used the wrong rider.",
      actorId: admin.id,
      actorRole: "super_admin",
    });

    const relatedItems = await testDb.db
      .select()
      .from(financialItems)
      .where(eq(financialItems.parcelId, parcelSeed.parcel.id));

    expect(relatedItems.find((item) => item.id === historicalAttempt.id)?.riderId).toBe(
      historicalRiderSeed.rider.id,
    );
    expect(relatedItems.find((item) => item.id === latestAttempt.id)?.riderId).toBe(
      correctedRiderSeed.rider.id,
    );
  });

  test("rejects delivered correction when no delivery attempt exists", async () => {
    const riderSeed = await seedTestRider(testDb.db);
    const admin = await seedTestUser(testDb.db, { role: "office_admin" });
    const parcelSeed = await seedTestParcel(testDb.db, {
      riderId: null,
      status: "postpone",
      assignedAt: null,
    });
    seededIds.parcelIds.push(parcelSeed.parcel.id);
    seededIds.userIds.push(
      riderSeed.user?.id ?? "",
      admin.id,
      parcelSeed.merchantSeed?.user?.id ?? "",
      parcelSeed.creator?.id ?? "",
    );
    seededIds.riderIds.push(riderSeed.rider.id);
    seededIds.townshipIds.push(riderSeed.township.id, parcelSeed.township.id);
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");

    const { correctParcelStatus } = await import("@/features/parcels/server/dal");

    await expectPromiseToRejectWith(
      correctParcelStatus({
        parcelId: parcelSeed.parcel.id,
        ...(await getParcelCorrectionExpectation(parcelSeed.parcel.id)),
        targetStatus: "delivered",
        targetRiderId: riderSeed.rider.id,
        proofImageKey: "proof-key",
        reason: "Attempt to skip delivery workflow.",
        actorId: admin.id,
        actorRole: "office_admin",
      }),
      "Correcting to delivered requires an existing delivery attempt. Use the normal start-delivery workflow first.",
    );

    const [unchangedParcel] = await testDb.db
      .select()
      .from(parcels)
      .where(eq(parcels.id, parcelSeed.parcel.id));
    expect(unchangedParcel.status).toBe("postpone");
  });

  test("corrects parcels to returned-to-merchant without duplicating deductions", async () => {
    const riderSeed = await seedTestRider(testDb.db);
    const admin = await seedTestUser(testDb.db, { role: "office_admin" });
    const parcelSeed = await seedTestParcel(testDb.db, {
      riderId: riderSeed.rider.id,
      status: "canceled_returned",
      assignedAt: new Date(),
    });
    seededIds.parcelIds.push(parcelSeed.parcel.id);
    seededIds.userIds.push(
      riderSeed.user?.id ?? "",
      admin.id,
      parcelSeed.merchantSeed?.user?.id ?? "",
      parcelSeed.creator?.id ?? "",
    );
    seededIds.riderIds.push(riderSeed.rider.id);
    seededIds.townshipIds.push(riderSeed.township.id, parcelSeed.township.id);
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");

    await testDb.db.insert(financialItems).values([
      {
        parcelId: parcelSeed.parcel.id,
        merchantId: parcelSeed.parcel.merchantId,
        riderId: null,
        itemType: "delivery_fee_deduction",
        amount: parcelSeed.parcel.deliveryFee,
        status: "pending",
        createdBy: admin.id,
      },
      {
        parcelId: parcelSeed.parcel.id,
        merchantId: parcelSeed.parcel.merchantId,
        riderId: riderSeed.rider.id,
        itemType: "rider_way_payout",
        riderWaySource: null,
        amount: 1,
        status: "pending",
        createdBy: admin.id,
      },
    ]);

    const { correctParcelStatus } = await import("@/features/parcels/server/dal");
    await correctParcelStatus({
      parcelId: parcelSeed.parcel.id,
      ...(await getParcelCorrectionExpectation(parcelSeed.parcel.id)),
      targetStatus: "returned_to_merchant",
      targetRiderId: riderSeed.rider.id,
      reason: "Return completion was missed.",
      actorId: admin.id,
      actorRole: "office_admin",
    });

    const relatedItems = await testDb.db
      .select()
      .from(financialItems)
      .where(eq(financialItems.parcelId, parcelSeed.parcel.id));
    const [updatedParcel] = await testDb.db
      .select()
      .from(parcels)
      .where(eq(parcels.id, parcelSeed.parcel.id));

    expect(updatedParcel).toMatchObject({
      status: "returned_to_merchant",
      deliveryFeeStatus: "deduct_from_merchant",
    });
    expect(updatedParcel.returnedToMerchantAt).toBeInstanceOf(Date);
    expect(relatedItems.filter((item) => item.itemType === "delivery_fee_deduction")).toHaveLength(
      1,
    );
    expect(
      relatedItems.filter(
        (item) => item.itemType === "rider_way_payout" && item.riderWaySource === "merchant_return",
      ),
    ).toHaveLength(1);
  });

  test("allows manual return correction without attributing a rider way", async () => {
    const admin = await seedTestUser(testDb.db, { role: "office_admin" });
    const parcelSeed = await seedTestParcel(testDb.db, {
      riderId: null,
      status: "canceled_returned",
      assignedAt: null,
    });
    seededIds.parcelIds.push(parcelSeed.parcel.id);
    seededIds.userIds.push(
      admin.id,
      parcelSeed.merchantSeed?.user?.id ?? "",
      parcelSeed.creator?.id ?? "",
    );
    seededIds.townshipIds.push(parcelSeed.township.id);
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");

    const { correctParcelStatus } = await import("@/features/parcels/server/dal");
    await correctParcelStatus({
      parcelId: parcelSeed.parcel.id,
      ...(await getParcelCorrectionExpectation(parcelSeed.parcel.id)),
      targetStatus: "returned_to_merchant",
      targetRiderId: null,
      reason: "Physical return was completed without an attributed rider.",
      actorId: admin.id,
      actorRole: "office_admin",
    });

    const relatedItems = await testDb.db
      .select()
      .from(financialItems)
      .where(eq(financialItems.parcelId, parcelSeed.parcel.id));
    const [updatedParcel] = await testDb.db
      .select()
      .from(parcels)
      .where(eq(parcels.id, parcelSeed.parcel.id));

    expect(updatedParcel).toMatchObject({
      status: "returned_to_merchant",
      riderId: null,
      deliveryFeeStatus: "deduct_from_merchant",
    });
    expect(relatedItems.filter((item) => item.itemType === "delivery_fee_deduction")).toHaveLength(
      1,
    );
    expect(relatedItems.filter((item) => item.itemType === "rider_way_payout")).toHaveLength(0);
  });

  test("corrects between non-financial statuses without creating financial items", async () => {
    const riderSeed = await seedTestRider(testDb.db);
    const admin = await seedTestUser(testDb.db, { role: "office_admin" });
    seededIds.userIds.push(riderSeed.user?.id ?? "", admin.id);
    seededIds.riderIds.push(riderSeed.rider.id);
    seededIds.townshipIds.push(riderSeed.township.id);
    const { correctParcelStatus } = await import("@/features/parcels/server/dal");

    const pairs = [
      {
        sourceStatus: "at_office" as const,
        targetStatus: "on_the_way" as const,
        initialRiderId: null,
        targetRiderId: riderSeed.rider.id,
      },
      {
        sourceStatus: "on_the_way" as const,
        targetStatus: "postpone" as const,
        initialRiderId: riderSeed.rider.id,
        targetRiderId: null,
      },
      {
        sourceStatus: "postpone" as const,
        targetStatus: "at_office" as const,
        initialRiderId: null,
        targetRiderId: null,
      },
      {
        sourceStatus: "at_office" as const,
        targetStatus: "canceled_returned" as const,
        initialRiderId: null,
        targetRiderId: null,
      },
    ];

    for (const pair of pairs) {
      const parcelSeed = await seedTestParcel(testDb.db, {
        riderId: pair.initialRiderId,
        status: pair.sourceStatus,
        assignedAt: pair.initialRiderId ? new Date() : null,
        deliveryFailureNote:
          pair.sourceStatus === "on_the_way" ? "Receiver asked to retry." : undefined,
      });
      seededIds.parcelIds.push(parcelSeed.parcel.id);
      seededIds.userIds.push(parcelSeed.merchantSeed?.user?.id ?? "", parcelSeed.creator?.id ?? "");
      seededIds.townshipIds.push(parcelSeed.township.id);
      seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");

      await correctParcelStatus({
        parcelId: parcelSeed.parcel.id,
        ...(await getParcelCorrectionExpectation(parcelSeed.parcel.id)),
        targetStatus: pair.targetStatus,
        targetRiderId: pair.targetRiderId,
        reason: `Correct ${pair.sourceStatus} to ${pair.targetStatus}.`,
        actorId: admin.id,
        actorRole: "office_admin",
      });

      const relatedItems = await testDb.db
        .select()
        .from(financialItems)
        .where(eq(financialItems.parcelId, parcelSeed.parcel.id));
      const [updatedParcel] = await testDb.db
        .select()
        .from(parcels)
        .where(eq(parcels.id, parcelSeed.parcel.id));

      expect(updatedParcel.status).toBe(pair.targetStatus);
      expect(relatedItems).toHaveLength(0);
    }
  });

  test("corrects delivered parcel rider without moving historical payout ownership", async () => {
    const historicalRiderSeed = await seedTestRider(testDb.db);
    const originalRiderSeed = await seedTestRider(testDb.db);
    const targetRiderSeed = await seedTestRider(testDb.db);
    const admin = await seedTestUser(testDb.db, { role: "super_admin" });
    const parcelSeed = await seedTestParcel(testDb.db, {
      riderId: originalRiderSeed.rider.id,
      status: "delivered",
      assignedAt: new Date(),
      deliveredAt: new Date(),
      collectedAt: new Date(),
      collectedAmount: 12_000,
      codStatus: "collected",
      deliveryFeeStatus: "collected",
      proofOfDeliveryImagesKeys: ["proof-key"],
    });
    seededIds.parcelIds.push(parcelSeed.parcel.id);
    seededIds.userIds.push(
      historicalRiderSeed.user?.id ?? "",
      originalRiderSeed.user?.id ?? "",
      targetRiderSeed.user?.id ?? "",
      admin.id,
      parcelSeed.merchantSeed?.user?.id ?? "",
      parcelSeed.creator?.id ?? "",
    );
    seededIds.riderIds.push(
      historicalRiderSeed.rider.id,
      originalRiderSeed.rider.id,
      targetRiderSeed.rider.id,
    );
    seededIds.townshipIds.push(
      historicalRiderSeed.township.id,
      originalRiderSeed.township.id,
      targetRiderSeed.township.id,
      parcelSeed.township.id,
    );
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");

    const [historicalAttempt, currentAttempt] = await testDb.db
      .insert(financialItems)
      .values([
        {
          parcelId: parcelSeed.parcel.id,
          merchantId: parcelSeed.parcel.merchantId,
          riderId: historicalRiderSeed.rider.id,
          itemType: "rider_way_payout",
          riderWaySource: "delivery_attempt",
          amount: 1,
          status: "pending",
          createdBy: admin.id,
          createdAt: new Date("2026-06-13T00:00:00.000Z"),
        },
        {
          parcelId: parcelSeed.parcel.id,
          merchantId: parcelSeed.parcel.merchantId,
          riderId: originalRiderSeed.rider.id,
          itemType: "rider_way_payout",
          riderWaySource: "delivery_attempt",
          amount: 1,
          status: "pending",
          createdBy: admin.id,
          createdAt: new Date("2026-06-14T00:00:00.000Z"),
        },
      ])
      .returning();

    const { correctParcelRider, listParcels, listParcelsForMerchantUser, listParcelsForRiderUser } =
      await import("@/features/parcels/server/dal");
    await correctParcelRider({
      parcelId: parcelSeed.parcel.id,
      ...(await getParcelCorrectionExpectation(parcelSeed.parcel.id)),
      targetRiderId: targetRiderSeed.rider.id,
      reason: "Parcel was assigned to the wrong rider.",
      actorId: admin.id,
      actorRole: "super_admin",
    });

    const [updatedParcel] = await testDb.db
      .select()
      .from(parcels)
      .where(eq(parcels.id, parcelSeed.parcel.id));
    const payoutItems = await testDb.db
      .select()
      .from(financialItems)
      .where(eq(financialItems.parcelId, parcelSeed.parcel.id));
    const [correctionLog] = await testDb.db
      .select()
      .from(parcelCorrectionLogs)
      .where(eq(parcelCorrectionLogs.parcelId, parcelSeed.parcel.id));

    expect(updatedParcel.riderId).toBe(targetRiderSeed.rider.id);
    expect(payoutItems.find((item) => item.id === historicalAttempt.id)?.riderId).toBe(
      historicalRiderSeed.rider.id,
    );
    expect(payoutItems.find((item) => item.id === currentAttempt.id)?.riderId).toBe(
      targetRiderSeed.rider.id,
    );
    expect(correctionLog).toMatchObject({
      correctionType: "rider",
      oldRiderId: originalRiderSeed.rider.id,
      newRiderId: targetRiderSeed.rider.id,
    });

    const [adminParcel] = (await listParcels()).filter((item) => item.id === parcelSeed.parcel.id);
    const [merchantParcel] = (
      await listParcelsForMerchantUser(parcelSeed.merchantSeed?.user?.id ?? "")
    ).filter((item) => item.id === parcelSeed.parcel.id);
    const [riderParcel] = (await listParcelsForRiderUser(targetRiderSeed.user?.id ?? "")).filter(
      (item) => item.id === parcelSeed.parcel.id,
    );

    expect(adminParcel.correctionLogs).toHaveLength(1);
    expect(merchantParcel.correctionLogs).toHaveLength(0);
    expect(riderParcel.correctionLogs).toHaveLength(0);
  });

  test("rejects stale corrections when financial items changed after review", async () => {
    const admin = await seedTestUser(testDb.db, { role: "office_admin" });
    const parcelSeed = await seedTestParcel(testDb.db, {
      status: "at_office",
    });
    seededIds.parcelIds.push(parcelSeed.parcel.id);
    seededIds.userIds.push(
      admin.id,
      parcelSeed.merchantSeed?.user?.id ?? "",
      parcelSeed.creator?.id ?? "",
    );
    seededIds.townshipIds.push(parcelSeed.township.id);
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");

    const reviewedState = await getParcelCorrectionExpectation(parcelSeed.parcel.id);

    await testDb.db.insert(financialItems).values({
      parcelId: parcelSeed.parcel.id,
      merchantId: parcelSeed.parcel.merchantId,
      riderId: null,
      itemType: "cod_remit",
      amount: parcelSeed.parcel.codAmount,
      status: "pending",
      createdBy: admin.id,
    });

    const { correctParcelStatus } = await import("@/features/parcels/server/dal");

    await expectPromiseToRejectWith(
      correctParcelStatus({
        parcelId: parcelSeed.parcel.id,
        ...reviewedState,
        targetStatus: "postpone",
        targetRiderId: null,
        reason: "Reviewed before financial state changed.",
        actorId: admin.id,
        actorRole: "office_admin",
      }),
      "Parcel changed since you opened it. Refresh and review before correcting.",
    );

    const correctionRows = await testDb.db
      .select()
      .from(parcelCorrectionLogs)
      .where(eq(parcelCorrectionLogs.parcelId, parcelSeed.parcel.id));

    expect(correctionRows).toHaveLength(0);
  });

  test("corrects rider on active statuses and blocks unsafe unassignment", async () => {
    const originalRiderSeed = await seedTestRider(testDb.db);
    const targetRiderSeed = await seedTestRider(testDb.db);
    const admin = await seedTestUser(testDb.db, { role: "office_admin" });
    seededIds.userIds.push(
      originalRiderSeed.user?.id ?? "",
      targetRiderSeed.user?.id ?? "",
      admin.id,
    );
    seededIds.riderIds.push(originalRiderSeed.rider.id, targetRiderSeed.rider.id);
    seededIds.townshipIds.push(originalRiderSeed.township.id, targetRiderSeed.township.id);
    const { correctParcelRider } = await import("@/features/parcels/server/dal");

    const atOfficeParcelSeed = await seedTestParcel(testDb.db, {
      riderId: originalRiderSeed.rider.id,
      status: "at_office",
      assignedAt: new Date(),
    });
    const onTheWayParcelSeed = await seedTestParcel(testDb.db, {
      riderId: originalRiderSeed.rider.id,
      status: "on_the_way",
      assignedAt: new Date(),
    });
    seededIds.parcelIds.push(atOfficeParcelSeed.parcel.id, onTheWayParcelSeed.parcel.id);
    seededIds.userIds.push(
      atOfficeParcelSeed.merchantSeed?.user?.id ?? "",
      atOfficeParcelSeed.creator?.id ?? "",
      onTheWayParcelSeed.merchantSeed?.user?.id ?? "",
      onTheWayParcelSeed.creator?.id ?? "",
    );
    seededIds.townshipIds.push(atOfficeParcelSeed.township.id, onTheWayParcelSeed.township.id);
    seededIds.merchantIds.push(
      atOfficeParcelSeed.merchantSeed?.merchant.id ?? "",
      onTheWayParcelSeed.merchantSeed?.merchant.id ?? "",
    );

    await correctParcelRider({
      parcelId: atOfficeParcelSeed.parcel.id,
      ...(await getParcelCorrectionExpectation(atOfficeParcelSeed.parcel.id)),
      targetRiderId: null,
      reason: "Parcel should be unassigned.",
      actorId: admin.id,
      actorRole: "office_admin",
    });
    await correctParcelRider({
      parcelId: onTheWayParcelSeed.parcel.id,
      ...(await getParcelCorrectionExpectation(onTheWayParcelSeed.parcel.id)),
      targetRiderId: targetRiderSeed.rider.id,
      reason: "Parcel was with the wrong rider.",
      actorId: admin.id,
      actorRole: "office_admin",
    });

    await expectPromiseToRejectWith(
      correctParcelRider({
        parcelId: onTheWayParcelSeed.parcel.id,
        ...(await getParcelCorrectionExpectation(onTheWayParcelSeed.parcel.id)),
        targetRiderId: null,
        reason: "Unsafe unassign attempt.",
        actorId: admin.id,
        actorRole: "office_admin",
      }),
      "This parcel status requires an active rider assignment.",
    );

    const [atOfficeParcel] = await testDb.db
      .select()
      .from(parcels)
      .where(eq(parcels.id, atOfficeParcelSeed.parcel.id));
    const [onTheWayParcel] = await testDb.db
      .select()
      .from(parcels)
      .where(eq(parcels.id, onTheWayParcelSeed.parcel.id));

    expect(atOfficeParcel.riderId).toBeNull();
    expect(onTheWayParcel.riderId).toBe(targetRiderSeed.rider.id);
  });

  test("blocks rider correction when the current delivery attempt is reserved", async () => {
    const originalRiderSeed = await seedTestRider(testDb.db);
    const targetRiderSeed = await seedTestRider(testDb.db);
    const admin = await seedTestUser(testDb.db, { role: "super_admin" });
    const parcelSeed = await seedTestParcel(testDb.db, {
      riderId: originalRiderSeed.rider.id,
      status: "on_the_way",
      assignedAt: new Date(),
    });
    seededIds.parcelIds.push(parcelSeed.parcel.id);
    seededIds.userIds.push(
      originalRiderSeed.user?.id ?? "",
      targetRiderSeed.user?.id ?? "",
      admin.id,
      parcelSeed.merchantSeed?.user?.id ?? "",
      parcelSeed.creator?.id ?? "",
    );
    seededIds.riderIds.push(originalRiderSeed.rider.id, targetRiderSeed.rider.id);
    seededIds.townshipIds.push(
      originalRiderSeed.township.id,
      targetRiderSeed.township.id,
      parcelSeed.township.id,
    );
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");

    await testDb.db.insert(financialItems).values({
      parcelId: parcelSeed.parcel.id,
      merchantId: parcelSeed.parcel.merchantId,
      riderId: originalRiderSeed.rider.id,
      itemType: "rider_way_payout",
      riderWaySource: "delivery_attempt",
      amount: 1,
      status: "in_progress",
      createdBy: admin.id,
    });

    const { correctParcelRider } = await import("@/features/parcels/server/dal");

    await expectPromiseToRejectWith(
      correctParcelRider({
        parcelId: parcelSeed.parcel.id,
        ...(await getParcelCorrectionExpectation(parcelSeed.parcel.id)),
        targetRiderId: targetRiderSeed.rider.id,
        reason: "Wrong rider.",
        actorId: admin.id,
        actorRole: "super_admin",
      }),
      "The current delivery attempt is already reserved or settled. Reverse that payout before correcting the rider.",
    );
  });

  test("blocks corrections when financial items are reserved", async () => {
    const riderSeed = await seedTestRider(testDb.db);
    const admin = await seedTestUser(testDb.db, { role: "super_admin" });
    const parcelSeed = await seedTestParcel(testDb.db, {
      riderId: riderSeed.rider.id,
      status: "delivered",
      assignedAt: new Date(),
      deliveredAt: new Date(),
      collectedAt: new Date(),
      collectedAmount: 12_000,
      codStatus: "collected",
      deliveryFeeStatus: "collected",
      proofOfDeliveryImagesKeys: ["proof-key"],
    });
    const [settlement] = await testDb.db
      .insert(merchantSettlements)
      .values({
        settlementCode: `MS-${crypto.randomUUID()}`,
        merchantId: parcelSeed.parcel.merchantId,
        status: "pending",
        createdBy: admin.id,
      })
      .returning();
    seededIds.parcelIds.push(parcelSeed.parcel.id);
    seededIds.settlementIds.push(settlement.id);
    seededIds.userIds.push(
      riderSeed.user?.id ?? "",
      admin.id,
      parcelSeed.merchantSeed?.user?.id ?? "",
      parcelSeed.creator?.id ?? "",
    );
    seededIds.riderIds.push(riderSeed.rider.id);
    seededIds.townshipIds.push(riderSeed.township.id, parcelSeed.township.id);
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");

    await testDb.db.insert(financialItems).values({
      parcelId: parcelSeed.parcel.id,
      merchantId: parcelSeed.parcel.merchantId,
      riderId: null,
      merchantSettlementId: settlement.id,
      itemType: "cod_remit",
      amount: parcelSeed.parcel.codAmount,
      status: "in_progress",
      createdBy: admin.id,
    });

    const { correctParcelStatus } = await import("@/features/parcels/server/dal");

    await expectPromiseToRejectWith(
      correctParcelStatus({
        parcelId: parcelSeed.parcel.id,
        ...(await getParcelCorrectionExpectation(parcelSeed.parcel.id)),
        targetStatus: "at_office",
        targetRiderId: null,
        reason: "Wrong delivered status.",
        actorId: admin.id,
        actorRole: "super_admin",
      }),
      "This parcel has financial items already reserved or settled. Reverse those records before correcting the parcel.",
    );

    const [unchangedParcel] = await testDb.db
      .select()
      .from(parcels)
      .where(eq(parcels.id, parcelSeed.parcel.id));
    const correctionRows = await testDb.db
      .select()
      .from(parcelCorrectionLogs)
      .where(eq(parcelCorrectionLogs.parcelId, parcelSeed.parcel.id));

    expect(unchangedParcel.status).toBe("delivered");
    expect(correctionRows).toHaveLength(0);
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

async function getParcelCorrectionExpectation(parcelId: string) {
  const { listParcels } = await import("@/features/parcels/server/dal");
  const parcel = (await listParcels()).find((item) => item.id === parcelId);

  if (!parcel) {
    throw new Error(`Parcel ${parcelId} was not found for correction expectation.`);
  }

  return {
    expectedStatus: parcel.status,
    expectedRiderId: parcel.riderId,
    expectedFinancialItemsFingerprint: parcel.correctionStateToken,
  };
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
