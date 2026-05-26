import { afterAll, afterEach, describe, expect, test } from "bun:test";
import type postgres from "postgres";

import { cleanupTestRecords } from "../fixtures/cleanup";
import { closeTestDatabase, createTestDatabase } from "../fixtures/db";
import { seedTestParcel, seedTestRider } from "../fixtures/seed";

const seededIds = {
  userIds: [] as string[],
  merchantIds: [] as string[],
  riderIds: [] as string[],
  townshipIds: [] as string[],
  parcelIds: [] as string[],
  bankAccountIds: [] as string[],
  settlementIds: [] as string[],
};

describe("parcel realtime RLS policies", () => {
  const testDb = createTestDatabase();

  afterAll(async () => {
    await closeTestDatabase(testDb.client);
  });

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

  test("limits authenticated parcel reads to each role scope", async () => {
    await applyRealtimeParcelMigration(testDb.client);

    const riderSeed = await seedTestRider(testDb.db);
    const riderParcelSeed = await seedTestParcel(testDb.db, { riderId: riderSeed.rider.id });
    const otherParcelSeed = await seedTestParcel(testDb.db);

    seededIds.userIds.push(
      riderSeed.user?.id ?? "",
      riderParcelSeed.merchantSeed?.user?.id ?? "",
      riderParcelSeed.creator?.id ?? "",
      otherParcelSeed.merchantSeed?.user?.id ?? "",
      otherParcelSeed.creator?.id ?? "",
    );
    seededIds.merchantIds.push(
      riderParcelSeed.merchantSeed?.merchant.id ?? "",
      otherParcelSeed.merchantSeed?.merchant.id ?? "",
    );
    seededIds.riderIds.push(riderSeed.rider.id);
    seededIds.townshipIds.push(
      riderSeed.township.id,
      riderParcelSeed.township.id,
      otherParcelSeed.township.id,
    );
    seededIds.parcelIds.push(riderParcelSeed.parcel.id, otherParcelSeed.parcel.id);

    const riderVisibleParcelIds = await selectVisibleParcelIds(testDb.client, {
      sub: riderSeed.user?.id ?? "",
      role: "rider",
    });
    const merchantVisibleParcelIds = await selectVisibleParcelIds(testDb.client, {
      sub: riderParcelSeed.merchantSeed?.user?.id ?? "",
      role: "merchant",
    });
    const adminVisibleParcelIds = await selectVisibleParcelIds(testDb.client, {
      sub: riderParcelSeed.creator?.id ?? "",
      role: "office_admin",
    });

    expect(riderVisibleParcelIds).toEqual([riderParcelSeed.parcel.id]);
    expect(merchantVisibleParcelIds).toEqual([riderParcelSeed.parcel.id]);
    expect(adminVisibleParcelIds).toContain(riderParcelSeed.parcel.id);
    expect(adminVisibleParcelIds).toContain(otherParcelSeed.parcel.id);
  });
});

async function selectVisibleParcelIds(
  sql: postgres.Sql,
  claims: {
    sub: string;
    role: "rider" | "merchant" | "office_admin";
  },
) {
  const rows = await sql.begin(async (tx) => {
    await tx`set local role authenticated`;
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ ...claims, aud: "authenticated" })}, true)`;

    return tx<{ id: string }[]>`
      select "id"
      from "parcels"
      where "deleted_at" is null
      order by "id"
    `;
  });

  return rows.map((row) => row.id);
}

async function applyRealtimeParcelMigration(sql: postgres.Sql) {
  const migrationSql = await Bun.file("src/db/migrations/0004_green_future_fund.sql").text();
  await sql.unsafe(migrationSql);
}
