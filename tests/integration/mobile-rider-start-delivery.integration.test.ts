import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";
import { inArray } from "drizzle-orm";

import { financialItems, parcels } from "@/db/schema";
import {
  mobileErrorResponseSchema,
  mobileStartDeliveryResponseSchema,
} from "@/features/mobile-api/contract";
import type { ParcelStatus } from "@/lib/domain";
import { buildSessionUser } from "../fixtures/builders";
import { cleanupTestRecords } from "../fixtures/cleanup";
import { closeTestDatabase, createTestDatabase } from "../fixtures/db";
import {
  seedTestMerchant,
  seedTestParcel,
  seedTestRider,
  seedTestTownship,
  seedTestUser,
} from "../fixtures/seed";

// The real operation, DAL and database run; only the session lookup is stubbed,
// so each test picks which rider is signed in. next/cache is stubbed by the preload.
let sessionUserId: string | null = null;

void mock.module("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: async () =>
        sessionUserId ? buildSessionUser({ id: sessionUserId, role: "rider" }) : null,
    },
  },
}));

void mock.module("next/headers", () => ({
  headers: async () => new Headers(),
}));

const seededIds = {
  userIds: [] as string[],
  merchantIds: [] as string[],
  riderIds: [] as string[],
  townshipIds: [] as string[],
  parcelIds: [] as string[],
};

describe("mobile rider start delivery integration", async () => {
  const testDb = createTestDatabase();
  const { POST } = await import("@/app/api/mobile/v1/rider/parcels/start-delivery/route");

  afterEach(async () => {
    sessionUserId = null;
    await cleanupTestRecords(testDb.db, seededIds);
    for (const ids of Object.values(seededIds)) {
      ids.length = 0;
    }
  });

  afterAll(async () => {
    await closeTestDatabase(testDb.client);
  });

  async function seedTwoRiders() {
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

    async function parcelFor(riderId: string, status: ParcelStatus) {
      const { parcel } = await seedTestParcel(testDb.db, {
        riderId,
        status,
        merchantId: merchantSeed.merchant.id,
        townshipId: township.id,
        createdBy: creator.id,
      });
      seededIds.parcelIds.push(parcel.id);
      return parcel;
    }

    return {
      riderAUserId: riderA.user?.id ?? "",
      riderAId: riderA.rider.id,
      aAtOffice1: await parcelFor(riderA.rider.id, "at_office"),
      aAtOffice2: await parcelFor(riderA.rider.id, "at_office"),
      aOnTheWay: await parcelFor(riderA.rider.id, "on_the_way"),
      bAtOffice: await parcelFor(riderB.rider.id, "at_office"),
    };
  }

  function start(parcelIds: string[]) {
    return POST(
      new Request("http://localhost:3000/api/mobile/v1/rider/parcels/start-delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parcelIds }),
      }),
    );
  }

  async function statusesOf(ids: string[]) {
    const rows = await testDb.db
      .select({ id: parcels.id, status: parcels.status })
      .from(parcels)
      .where(inArray(parcels.id, ids));
    return Object.fromEntries(rows.map((row) => [row.id, row.status]));
  }

  async function payoutsFor(ids: string[]) {
    return testDb.db
      .select({
        parcelId: financialItems.parcelId,
        riderId: financialItems.riderId,
        itemType: financialItems.itemType,
        riderWaySource: financialItems.riderWaySource,
        status: financialItems.status,
      })
      .from(financialItems)
      .where(inArray(financialItems.parcelId, ids));
  }

  test("the rider's own at-office parcels move to on the way, with one payout each", async () => {
    const seed = await seedTwoRiders();
    sessionUserId = seed.riderAUserId;
    const ids = [seed.aAtOffice1.id, seed.aAtOffice2.id];

    const response = await start(ids);

    expect(response.status).toBe(200);
    const body = mobileStartDeliveryResponseSchema.parse(await response.json());
    expect(body.data.parcelIds.toSorted()).toEqual(ids.toSorted());
    expect(await statusesOf(ids)).toEqual({
      [seed.aAtOffice1.id]: "on_the_way",
      [seed.aAtOffice2.id]: "on_the_way",
    });

    const payouts = await payoutsFor(ids);
    expect(payouts).toHaveLength(2);
    for (const payout of payouts) {
      expect(payout).toMatchObject({
        riderId: seed.riderAId,
        itemType: "rider_way_payout",
        riderWaySource: "delivery_attempt",
        status: "pending",
      });
    }
  });

  test("a batch with another rider's parcel is a 404 and changes nothing", async () => {
    const seed = await seedTwoRiders();
    sessionUserId = seed.riderAUserId;
    const ids = [seed.aAtOffice1.id, seed.bAtOffice.id];

    const response = await start(ids);

    expect(response.status).toBe(404);
    expect(mobileErrorResponseSchema.parse(await response.json()).message).toBe(
      "One or more selected parcels were not found.",
    );
    expect(await statusesOf(ids)).toEqual({
      [seed.aAtOffice1.id]: "at_office",
      [seed.bAtOffice.id]: "at_office",
    });
    expect(await payoutsFor(ids)).toHaveLength(0);
  });

  test("a parcel already on the way is a 409, and a repeated start is too", async () => {
    const seed = await seedTwoRiders();
    sessionUserId = seed.riderAUserId;

    expect((await start([seed.aOnTheWay.id])).status).toBe(409);

    expect((await start([seed.aAtOffice1.id])).status).toBe(200);
    expect((await start([seed.aAtOffice1.id])).status).toBe(409);
    expect(await payoutsFor([seed.aAtOffice1.id])).toHaveLength(1);
  });
});
