import { afterAll, afterEach, describe, expect, test } from "bun:test";
import type postgres from "postgres";

import { cleanupTestRecords } from "../fixtures/cleanup";
import { closeTestDatabase, createTestDatabase } from "../fixtures/db";
import { seedTestParcel } from "../fixtures/seed";

const seededIds = {
  userIds: [] as string[],
  merchantIds: [] as string[],
  riderIds: [] as string[],
  townshipIds: [] as string[],
  parcelIds: [] as string[],
  bankAccountIds: [] as string[],
  settlementIds: [] as string[],
};

describe("table RLS policies", () => {
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

  test("denies authenticated role access to sensitive tables by default", async () => {
    const parcelSeed = await seedTestParcel(testDb.db);

    seededIds.userIds.push(parcelSeed.merchantSeed?.user?.id ?? "", parcelSeed.creator?.id ?? "");
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");
    seededIds.townshipIds.push(parcelSeed.township.id);
    seededIds.parcelIds.push(parcelSeed.parcel.id);

    const merchantUserId = parcelSeed.merchantSeed?.user?.id ?? "";

    await expectAuthenticatedQueryToBeDenied(
      testDb.client,
      merchantUserId,
      "merchant",
      (tx) =>
        tx`
          select "id"
          from "financial_items"
          limit 1
        `,
    );

    await expectAuthenticatedQueryToBeDenied(
      testDb.client,
      merchantUserId,
      "merchant",
      (tx) =>
        tx`
          select "id"
          from "user"
          limit 1
        `,
    );

    await expectAuthenticatedQueryToBeDenied(
      testDb.client,
      merchantUserId,
      "merchant",
      (tx) =>
        tx`
          select "id"
          from "townships"
          limit 1
        `,
    );
  });

  test("allows merchants and riders to read their own profile rows for parcel policy checks", async () => {
    const parcelSeed = await seedTestParcel(testDb.db);

    seededIds.userIds.push(parcelSeed.merchantSeed?.user?.id ?? "", parcelSeed.creator?.id ?? "");
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");
    seededIds.townshipIds.push(parcelSeed.township.id);
    seededIds.parcelIds.push(parcelSeed.parcel.id);

    const merchantUserId = parcelSeed.merchantSeed?.user?.id ?? "";
    const merchantId = parcelSeed.merchantSeed?.merchant.id ?? "";

    const merchantRows = await asAuthenticated(
      testDb.client,
      merchantUserId,
      "merchant",
      (tx) =>
        tx<{ id: string }[]>`
        select "id"
        from "merchants"
        where "id" = ${merchantId}
      `,
    );

    expect(merchantRows.map((row) => row.id)).toEqual([merchantId]);
  });
});

async function expectAuthenticatedQueryToBeDenied(
  sql: postgres.Sql,
  userId: string,
  role: "merchant" | "rider" | "office_admin" | "super_admin",
  query: (tx: postgres.TransactionSql) => Promise<unknown>,
) {
  try {
    await asAuthenticated(sql, userId, role, query);
  } catch (error) {
    expect(error).toMatchObject({ code: "42501" });
    return;
  }

  throw new Error("Expected authenticated query to be denied.");
}

async function asAuthenticated<T>(
  sql: postgres.Sql,
  userId: string,
  role: "merchant" | "rider" | "office_admin" | "super_admin",
  query: (tx: postgres.TransactionSql) => Promise<T>,
) {
  return sql.begin(async (tx) => {
    await tx`set local role authenticated`;
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({
      sub: userId,
      role,
      aud: "authenticated",
    })}, true)`;

    return query(tx);
  });
}
