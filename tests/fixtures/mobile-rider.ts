// Shared setup for the mobile rider write-route integration tests: a stubbed
// session lookup, and a seed of two riders with parcels to act on.
import { afterAll, afterEach, mock } from "bun:test";

import type { ParcelStatus } from "@/lib/domain";
import { buildSessionUser } from "./builders";
import { cleanupTestRecords } from "./cleanup";
import { closeTestDatabase, createTestDatabase } from "./db";
import {
  seedTestMerchant,
  seedTestParcel,
  seedTestRider,
  seedTestTownship,
  seedTestUser,
} from "./seed";

/**
 * Makes `@/lib/auth` see `signInAs`'s rider as signed in. With nobody signed
 * in it falls back to the real session lookup. Bun keeps module mocks for later
 * test files, so the real exports stay in place (mobile-auth.integration.test.ts
 * needs the real `auth.handler` and sessions). They are captured before
 * mocking, because the module namespace is live and gets patched.
 */
export async function mockMobileRiderSession() {
  let sessionUserId: string | null = null;

  void mock.module("next/headers", () => ({
    headers: () => Promise.resolve(new Headers()),
  }));

  const actualAuth = { ...(await import("@/lib/auth")) };
  const realAuth = actualAuth.auth;
  const realGetSession = realAuth.api.getSession.bind(realAuth.api);

  void mock.module("@/lib/auth", () => ({
    ...actualAuth,
    auth: {
      ...realAuth,
      api: {
        ...realAuth.api,
        getSession: (...args: Parameters<typeof realGetSession>) =>
          sessionUserId
            ? Promise.resolve(buildSessionUser({ id: sessionUserId, role: "rider" }))
            : realGetSession(...args),
      },
    },
  }));

  return {
    signInAs(userId: string | null) {
      sessionUserId = userId;
    },
  };
}

type MobileRiderSession = Awaited<ReturnType<typeof mockMobileRiderSession>>;

export type SeededIds = {
  userIds: string[];
  merchantIds: string[];
  riderIds: string[];
  townshipIds: string[];
  parcelIds: string[];
};

export function createSeededIds(): SeededIds {
  return { userIds: [], merchantIds: [], riderIds: [], townshipIds: [], parcelIds: [] };
}

type ParcelSeedOverrides = NonNullable<Parameters<typeof seedTestParcel>[1]>;

/**
 * The test database for a describe block. After each test it signs the rider
 * out and removes what was seeded; after the block it closes the connection.
 */
export function useMobileRiderTestDb(session: MobileRiderSession) {
  const testDb = createTestDatabase();
  const seededIds = createSeededIds();

  afterEach(async () => {
    session.signInAs(null);
    await cleanupTestRecords(testDb.db, seededIds);
    for (const ids of Object.values(seededIds)) {
      ids.length = 0;
    }
  });

  afterAll(async () => {
    await closeTestDatabase(testDb.client);
  });

  return { testDb, seededIds };
}

/**
 * Seeds riders A and B in one township, and returns `parcelFor` to seed
 * parcels (COD, 20,000 MMK plus a 3,000 MMK fee, unless overridden) for either
 * of them, or unassigned. Every id is recorded in `seededIds` for cleanup.
 */
export async function seedTwoRiders(
  testDb: ReturnType<typeof createTestDatabase>,
  seededIds: SeededIds,
) {
  const township = await seedTestTownship(testDb.db);
  const creator = await seedTestUser(testDb.db, { role: "super_admin" });
  const merchantSeed = await seedTestMerchant(testDb.db);
  const riderA = await seedTestRider(testDb.db, { townshipId: township.id });
  const riderB = await seedTestRider(testDb.db, { townshipId: township.id });

  seededIds.townshipIds.push(township.id);
  seededIds.userIds.push(
    creator.id,
    merchantSeed.user?.id ?? "",
    riderA.user?.id ?? "",
    riderB.user?.id ?? "",
  );
  seededIds.merchantIds.push(merchantSeed.merchant.id);
  seededIds.riderIds.push(riderA.rider.id, riderB.rider.id);

  async function parcelFor(
    riderId: string | undefined,
    status: ParcelStatus,
    overrides: ParcelSeedOverrides = {},
  ) {
    const { parcel } = await seedTestParcel(testDb.db, {
      riderId,
      status,
      merchantId: merchantSeed.merchant.id,
      townshipId: township.id,
      createdBy: creator.id,
      parcelType: "cod",
      codAmount: 20_000,
      deliveryFee: 3_000,
      ...overrides,
    });
    seededIds.parcelIds.push(parcel.id);
    return parcel;
  }

  return {
    riderAId: riderA.rider.id,
    riderAUserId: riderA.user?.id ?? "",
    riderBUserId: riderB.user?.id ?? "",
    merchant: {
      address: merchantSeed.merchant.address,
      phoneNumber: merchantSeed.user?.phoneNumber ?? null,
    },
    riderBId: riderB.rider.id,
    parcelFor,
  };
}
