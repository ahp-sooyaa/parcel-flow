import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";

import {
  mobileRiderParcelDetailResponseSchema,
  mobileRiderParcelPageResponseSchema,
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

// The real DAL and database run; only the session lookup is stubbed, so each
// test picks which rider is signed in.
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

describe("mobile rider parcels integration", async () => {
  const testDb = createTestDatabase();
  const { GET: getList } = await import("@/app/api/mobile/v1/rider/parcels/route");
  const { GET: getDetail } = await import("@/app/api/mobile/v1/rider/parcels/[parcelId]/route");

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

  async function seedTwoRidersWithParcels() {
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

    async function parcelFor(riderId: string | undefined, status: ParcelStatus) {
      const { parcel } = await seedTestParcel(testDb.db, {
        riderId,
        status,
        merchantId: merchantSeed.merchant.id,
        townshipId: township.id,
        createdBy: creator.id,
        codAmount: 20_000,
        deliveryFee: 3_000,
      });
      seededIds.parcelIds.push(parcel.id);
      return parcel;
    }

    const aParcels = {
      atOffice: await parcelFor(riderA.rider.id, "at_office"),
      onTheWay: await parcelFor(riderA.rider.id, "on_the_way"),
      canceled: await parcelFor(riderA.rider.id, "canceled_returned"),
      delivered: await parcelFor(riderA.rider.id, "delivered"),
      returned: await parcelFor(riderA.rider.id, "returned_to_merchant"),
    };
    const bParcel = await parcelFor(riderB.rider.id, "on_the_way");
    const unassigned = await parcelFor(undefined, "at_office");

    return { riderAUserId: riderA.user?.id ?? "", aParcels, bParcel, unassigned };
  }

  async function listTab(tab: string) {
    const response = await getList(
      new Request(`http://localhost:3000/api/mobile/v1/rider/parcels?tab=${tab}`),
    );
    expect(response.status).toBe(200);
    return mobileRiderParcelPageResponseSchema.parse(await response.json()).data;
  }

  test("each tab lists only the signed-in rider's parcels, with matching counts", async () => {
    const { riderAUserId, aParcels, bParcel, unassigned } = await seedTwoRidersWithParcels();
    sessionUserId = riderAUserId;

    const toDeliver = await listTab("to_deliver");
    const delivered = await listTab("delivered");
    const returned = await listTab("returned");

    expect(toDeliver.parcels.map((parcel) => parcel.id).toSorted()).toEqual(
      [aParcels.atOffice.id, aParcels.onTheWay.id, aParcels.canceled.id].toSorted(),
    );
    expect(delivered.parcels.map((parcel) => parcel.id)).toEqual([aParcels.delivered.id]);
    expect(returned.parcels.map((parcel) => parcel.id)).toEqual([aParcels.returned.id]);
    expect(toDeliver.tabCounts).toEqual({ to_deliver: 3, delivered: 1, returned: 1 });
    expect(toDeliver.parcels[0]?.amountToCollect).toBe(23_000);

    const allIds = [...toDeliver.parcels, ...delivered.parcels, ...returned.parcels].map(
      (parcel) => parcel.id,
    );
    expect(allIds).not.toContain(bParcel.id);
    expect(allIds).not.toContain(unassigned.id);
  });

  test("the detail works for the rider's own parcel and is a 404 for anyone else's", async () => {
    const { riderAUserId, aParcels, bParcel, unassigned } = await seedTwoRidersWithParcels();
    sessionUserId = riderAUserId;

    const detail = (id: string) =>
      getDetail(new Request("http://localhost"), { params: Promise.resolve({ parcelId: id }) });

    const own = await detail(aParcels.onTheWay.id);
    expect(own.status).toBe(200);
    expect(mobileRiderParcelDetailResponseSchema.parse(await own.json()).data).toMatchObject({
      id: aParcels.onTheWay.id,
      status: "on_the_way",
      codAmount: 20_000,
      deliveryFee: 3_000,
      amountToCollect: 23_000,
    });

    for (const id of [bParcel.id, unassigned.id, crypto.randomUUID()]) {
      const response = await detail(id);
      expect(response.status).toBe(404);
      expect((await response.json()).message).toBe("Parcel not found.");
    }
  });
});
