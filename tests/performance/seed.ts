import { inArray, like, sql } from "drizzle-orm";

import { closeDatabase } from "@/db";
import {
  appUsers,
  bankAccounts,
  financialItems,
  merchantSettlements,
  merchants,
  parcels,
  parcelCorrectionLogs,
  parcelStatusLogs,
  riderPayouts,
  riders,
  townships,
} from "@/db/schema";

import { cleanupTestRecords } from "../fixtures/cleanup";
import { closeTestDatabase, createTestDatabase } from "../fixtures/db";
import { seedTestMerchant, seedTestRider, seedTestTownship } from "../fixtures/seed";
import { perfUserPassword, seedPerfAuthUser } from "./auth";
import { writePerfContext } from "./context";
import { runPerfScript } from "./exit";
import { logProgress } from "./progress";
import { getParcelCountForScale, parsePerfScale } from "./scales";

const perfSeed = process.env.PERF_SEED ?? "42";
const perfScale = parsePerfScale();
const parcelCount = getParcelCountForScale(perfScale);
const shouldReset = process.env.PERF_RESET !== "0";

const parcelStatuses = [
  "at_office",
  "on_the_way",
  "delivered",
  "postpone",
  "canceled_returned",
] as const;

const perfUsernames = {
  superAdmin: `perf-${perfSeed}-super-admin`,
  merchant: `perf-${perfSeed}-merchant`,
  rider: `perf-${perfSeed}-rider-1`,
} as const;

async function main() {
  const { db, client } = createTestDatabase();

  try {
    console.log(
      `Preparing perf seed (scale=${perfScale}, parcels=${parcelCount}, seed=${perfSeed})...`,
    );
    await cleanupPerfSeedArtifacts(db);

    if (shouldReset) {
      console.log("Resetting all parcel data (PERF_RESET=1)...");
      await resetParcelData(db);
    }

    const superAdmin = await seedPerfAuthUser(db, {
      username: perfUsernames.superAdmin,
      name: "Perf Super Admin",
      role: "super_admin",
      phoneNumber: "09920000001",
      address: "Perf super admin address",
    });
    const merchantUser = await seedPerfAuthUser(db, {
      username: perfUsernames.merchant,
      name: "Perf Merchant",
      role: "merchant",
      phoneNumber: "09920000002",
      address: "Perf merchant address",
    });
    const merchantSeed = await seedTestMerchant(db, {
      shopName: `Perf Shop ${perfSeed}`,
      userId: merchantUser.id,
    });
    const townshipIds: string[] = [];
    const riderIds: string[] = [];
    const riderUserIds: string[] = [];

    for (let index = 0; index < 3; index++) {
      const township = await seedTestTownship(db, {
        name: `Perf Township ${perfSeed} ${index + 1}`,
      });
      townshipIds.push(township.id);

      const riderUsername =
        index === 0 ? perfUsernames.rider : `perf-${perfSeed}-rider-${index + 1}`;
      const riderUser = await seedPerfAuthUser(db, {
        username: riderUsername,
        name: `Perf Rider ${index + 1}`,
        role: "rider",
        phoneNumber: `0992000000${index + 3}`,
        address: `Perf rider ${index + 1} address`,
      });
      const riderSeed = await seedTestRider(db, {
        townshipId: township.id,
        userId: riderUser.id,
      });
      riderIds.push(riderSeed.rider.id);
      riderUserIds.push(riderUser.id);
    }

    await db.insert(bankAccounts).values({
      userId: merchantUser.id,
      bankName: "Perf Bank",
      accountHolderName: "Perf Merchant",
      accountNumber: "1234567890",
      isPrimary: true,
    });

    const batchSize = 500;
    let inserted = 0;
    logProgress("Inserting parcels", inserted, parcelCount);

    while (inserted < parcelCount) {
      const currentBatchSize = Math.min(batchSize, parcelCount - inserted);
      const values = Array.from({ length: currentBatchSize }, (_, offset) => {
        const parcelIndex = inserted + offset;
        const status = parcelStatuses[parcelIndex % parcelStatuses.length] ?? "at_office";
        const riderId =
          parcelIndex % 4 === 0 ? null : (riderIds[parcelIndex % riderIds.length] ?? null);
        const townshipId = townshipIds[parcelIndex % townshipIds.length] ?? townshipIds[0];
        const isDelivered = status === "delivered";
        const codAmount = parcelIndex % 5 === 0 ? 0 : 5_000 + (parcelIndex % 20) * 500;
        const deliveryFee = 1_500 + (parcelIndex % 10) * 100;

        if (!townshipId) {
          throw new Error("Perf seed requires at least one township.");
        }

        return {
          parcelCode: `PERF-${perfSeed}-${String(parcelIndex + 1).padStart(6, "0")}`,
          merchantId: merchantSeed.merchant.id,
          riderId,
          townshipId,
          receiverName: `Perf Receiver ${parcelIndex + 1}`,
          receiverPhoneNumber: `09${String(1_000_000_000 + parcelIndex).slice(-9)}`,
          receiverAddress: `Perf address ${parcelIndex + 1}`,
          parcelType: parcelIndex % 5 === 0 ? "non_cod" : "cod",
          codAmount,
          deliveryFee,
          weightKg: String(1 + (parcelIndex % 8)),
          status,
          isReceivedByOffice: isDelivered && parcelIndex % 2 === 0,
          collectedAmount: isDelivered ? codAmount + deliveryFee : 0,
          deliveredAt: isDelivered ? new Date(Date.now() - parcelIndex * 30_000) : null,
          createdBy: superAdmin.id,
          assignedAt: riderId ? new Date(Date.now() - parcelIndex * 60_000) : null,
          createdAt: new Date(Date.now() - parcelIndex * 120_000),
        };
      });

      await db.insert(parcels).values(values);
      inserted += currentBatchSize;
      logProgress("Inserting parcels", inserted, parcelCount);
    }

    const recomputeParcelIds = await seedPerfFinancialData(db, {
      perfSeed,
      merchantId: merchantSeed.merchant.id,
      superAdminId: superAdmin.id,
    });
    await seedPerfSettlementAndPayoutHistory(db, {
      merchantId: merchantSeed.merchant.id,
      riderId: riderIds[0] ?? "",
      superAdminId: superAdmin.id,
    });

    const merchantUserId = merchantSeed.merchant.userId;
    if (!merchantUserId) {
      throw new Error("Perf seed merchant is missing a user ID.");
    }

    const primaryRiderUserId = riderUserIds[0];
    if (!primaryRiderUserId) {
      throw new Error("Perf seed rider is missing a user ID.");
    }

    await writePerfContext({
      perfSeed,
      perfScale,
      parcelCount,
      superAdminUserId: superAdmin.id,
      merchantUserId,
      merchantId: merchantSeed.merchant.id,
      riderUserIds,
      riderIds,
      townshipIds,
      recomputeParcelIds,
      users: {
        superAdmin: { username: perfUsernames.superAdmin, password: perfUserPassword },
        merchant: { username: perfUsernames.merchant, password: perfUserPassword },
        rider: { username: perfUsernames.rider, password: perfUserPassword },
      },
    });

    console.log(`Perf seed complete (${perfScale}, ${parcelCount} parcels, seed=${perfSeed}).`);
    console.log(`Super admin: ${perfUsernames.superAdmin}`);
    console.log(`Merchant: ${perfUsernames.merchant}`);
    console.log(`Rider: ${perfUsernames.rider}`);
  } finally {
    await closeTestDatabase(client);
    await closeDatabase();
  }
}

async function seedPerfFinancialData(
  db: ReturnType<typeof createTestDatabase>["db"],
  input: { perfSeed: string; merchantId: string; superAdminId: string },
) {
  const perfParcels = await db
    .select({
      id: parcels.id,
      merchantId: parcels.merchantId,
      riderId: parcels.riderId,
      status: parcels.status,
      parcelType: parcels.parcelType,
      codAmount: parcels.codAmount,
      deliveryFee: parcels.deliveryFee,
    })
    .from(parcels)
    .where(like(parcels.parcelCode, `PERF-${input.perfSeed}-%`));

  const financialItemValues: Array<typeof financialItems.$inferInsert> = [];
  const recomputeParcelIds: string[] = [];

  for (const [index, parcel] of perfParcels.entries()) {
    if (
      parcel.status === "delivered" &&
      parcel.parcelType === "cod" &&
      index % 2 === 0 &&
      parcel.merchantId
    ) {
      financialItemValues.push(
        {
          parcelId: parcel.id,
          merchantId: parcel.merchantId,
          itemType: "cod_remit",
          amount: parcel.codAmount,
          status: "pending",
          createdBy: input.superAdminId,
        },
        {
          parcelId: parcel.id,
          merchantId: parcel.merchantId,
          itemType: "delivery_fee_deduction",
          amount: parcel.deliveryFee,
          status: "pending",
          createdBy: input.superAdminId,
        },
      );
    }

    if (
      parcel.riderId &&
      (parcel.status === "on_the_way" || parcel.status === "delivered") &&
      index % 3 === 0
    ) {
      financialItemValues.push({
        parcelId: parcel.id,
        merchantId: input.merchantId,
        riderId: parcel.riderId,
        itemType: "rider_way_payout",
        riderWaySource: "delivery_attempt",
        amount: 500,
        status: "pending",
        createdBy: input.superAdminId,
      });

      if (recomputeParcelIds.length < 50) {
        recomputeParcelIds.push(parcel.id);
      }
    }
  }

  const insertBatchSize = 500;
  for (let offset = 0; offset < financialItemValues.length; offset += insertBatchSize) {
    await db
      .insert(financialItems)
      .values(financialItemValues.slice(offset, offset + insertBatchSize));
  }

  console.log(`Seeded ${financialItemValues.length} financial items for perf benchmarks.`);
  return recomputeParcelIds;
}

async function seedPerfSettlementAndPayoutHistory(
  db: ReturnType<typeof createTestDatabase>["db"],
  input: { merchantId: string; riderId: string; superAdminId: string },
) {
  if (!input.riderId) {
    return;
  }

  const datePart = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Bangkok",
  })
    .format(new Date())
    .replaceAll("-", "");

  await db.insert(merchantSettlements).values([
    {
      settlementCode: `MS-PERF-${datePart}-001`,
      merchantId: input.merchantId,
      status: "settled",
      totalCodAmount: 50_000,
      totalDeliveryFeeDeduction: 5_000,
      netPaymentAmount: 45_000,
      createdBy: input.superAdminId,
      paidAt: new Date(),
    },
    {
      settlementCode: `MS-PERF-${datePart}-002`,
      merchantId: input.merchantId,
      status: "pending",
      totalCodAmount: 20_000,
      totalDeliveryFeeDeduction: 2_000,
      netPaymentAmount: 18_000,
      createdBy: input.superAdminId,
    },
  ]);

  await db.insert(riderPayouts).values([
    {
      payoutCode: `RP-PERF-${datePart}-001`,
      riderId: input.riderId,
      status: "settled",
      feePerWay: 500,
      deliveredWayCount: 10,
      totalPayoutAmount: 5_000,
      createdBy: input.superAdminId,
      paidAt: new Date(),
    },
    {
      payoutCode: `RP-PERF-${datePart}-002`,
      riderId: input.riderId,
      status: "pending",
      feePerWay: 500,
      deliveredWayCount: 4,
      totalPayoutAmount: 2_000,
      createdBy: input.superAdminId,
    },
  ]);
}

async function cleanupPerfSeedArtifacts(db: ReturnType<typeof createTestDatabase>["db"]) {
  const perfUsers = await db
    .select({ id: appUsers.id })
    .from(appUsers)
    .where(like(appUsers.username, `perf-${perfSeed}-%`));

  const userIds = perfUsers.map((user) => user.id);
  const perfParcelRows = await db
    .select({ id: parcels.id })
    .from(parcels)
    .where(sql`${parcels.parcelCode} like ${`PERF-${perfSeed}-%`}`);

  const parcelIds = perfParcelRows.map((row) => row.id);
  const merchantIds =
    userIds.length === 0
      ? []
      : (
          await db
            .select({ id: merchants.id })
            .from(merchants)
            .where(inArray(merchants.userId, userIds))
        ).map((row) => row.id);
  const riderIds =
    userIds.length === 0
      ? []
      : (
          await db.select({ id: riders.id }).from(riders).where(inArray(riders.userId, userIds))
        ).map((row) => row.id);
  const townshipIds = (
    await db
      .select({ id: townships.id })
      .from(townships)
      .where(like(townships.name, `Perf Township ${perfSeed} %`))
  ).map((row) => row.id);
  const settlementIds =
    merchantIds.length === 0
      ? []
      : (
          await db
            .select({ id: merchantSettlements.id })
            .from(merchantSettlements)
            .where(inArray(merchantSettlements.merchantId, merchantIds))
        ).map((row) => row.id);
  const riderPayoutIds =
    riderIds.length === 0
      ? []
      : (
          await db
            .select({ id: riderPayouts.id })
            .from(riderPayouts)
            .where(inArray(riderPayouts.riderId, riderIds))
        ).map((row) => row.id);
  const bankAccountIds =
    userIds.length === 0
      ? []
      : (
          await db
            .select({ id: bankAccounts.id })
            .from(bankAccounts)
            .where(inArray(bankAccounts.userId, userIds))
        ).map((row) => row.id);

  if (
    parcelIds.length === 0 &&
    userIds.length === 0 &&
    merchantIds.length === 0 &&
    riderIds.length === 0 &&
    townshipIds.length === 0 &&
    settlementIds.length === 0 &&
    riderPayoutIds.length === 0 &&
    bankAccountIds.length === 0
  ) {
    return;
  }

  console.log(
    `Cleaning previous perf seed artifacts (users=${userIds.length}, parcels=${parcelIds.length})...`,
  );

  await cleanupTestRecords(db, {
    parcelIds,
    riderIds,
    merchantIds,
    townshipIds,
    userIds,
    settlementIds,
    riderPayoutIds,
    bankAccountIds,
  });
}

async function resetParcelData(db: ReturnType<typeof createTestDatabase>["db"]) {
  await db.delete(financialItems);
  await db.delete(merchantSettlements);
  await db.delete(riderPayouts);
  await db.delete(parcelCorrectionLogs);
  await db.delete(parcelStatusLogs);
  await db.delete(parcels);
}

runPerfScript(main);
