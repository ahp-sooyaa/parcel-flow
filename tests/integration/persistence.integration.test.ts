import { afterEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { parcels } from "@/db/schema";
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

  test("rejects parcel creation when the merchant does not exist", async () => {
    const township = await seedTestTownship(testDb.db);
    const creator = await seedTestUser(testDb.db, { role: "super_admin" });
    seededIds.townshipIds.push(township.id);
    seededIds.userIds.push(creator.id);

    const { createParcel } = await import("@/features/parcels/server/dal");

    await expect(
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
    ).rejects.toThrow("Merchant was not found.");
  });

  test("rejects parcel creation when the township is inactive", async () => {
    const merchantSeed = await seedTestMerchant(testDb.db);
    const township = await seedTestTownship(testDb.db, { isActive: false });
    const creator = await seedTestUser(testDb.db, { role: "super_admin" });
    seededIds.userIds.push(merchantSeed.user?.id ?? "", creator.id);
    seededIds.merchantIds.push(merchantSeed.merchant.id);
    seededIds.townshipIds.push(township.id);

    const { createParcel } = await import("@/features/parcels/server/dal");

    await expect(
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
    ).rejects.toThrow("Active township was not found.");
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

    await expect(
      assignParcelsToRider({
        riderId: inactiveRiderSeed.rider.id,
        parcelIds: [parcelSeed.parcel.id],
      }),
    ).rejects.toThrow("Active rider was not found.");
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

    await expect(
      assignParcelsToRider({
        riderId: riderSeed.rider.id,
        parcelIds: [parcelSeed.parcel.id, crypto.randomUUID()],
      }),
    ).rejects.toThrow("One or more selected parcels were not found.");

    await expect(
      assignParcelsToRider({
        riderId: riderSeed.rider.id,
        parcelIds: [deliveredParcelSeed.parcel.id],
      }),
    ).rejects.toThrow("Only unassigned at-office, postponed, or returned parcels can be assigned.");
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
      where: (riders, { eq }) => eq(riders.userId, user.id),
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
