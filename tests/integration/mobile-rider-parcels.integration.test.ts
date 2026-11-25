import { describe, expect, test } from "bun:test";

import {
  mobileRiderParcelDetailResponseSchema,
  mobileRiderParcelPageResponseSchema,
} from "@/features/mobile-api/contract";
import {
  mockMobileRiderSession,
  seedTwoRiders,
  useMobileRiderTestDb,
} from "../fixtures/mobile-rider";

// The real DAL and database run; only the session lookup is stubbed, so each
// test picks which rider is signed in.
const session = await mockMobileRiderSession();

describe("mobile rider parcels integration", async () => {
  const { testDb, seededIds } = useMobileRiderTestDb(session);
  const { GET: getList } = await import("@/app/api/mobile/v1/rider/parcels/route");
  const { GET: getDetail } = await import("@/app/api/mobile/v1/rider/parcels/[parcelId]/route");

  async function seedTwoRidersWithParcels() {
    const seed = await seedTwoRiders(testDb, seededIds);

    const aParcels = {
      atOffice: await seed.parcelFor(seed.riderAId, "at_office"),
      onTheWay: await seed.parcelFor(seed.riderAId, "on_the_way"),
      canceled: await seed.parcelFor(seed.riderAId, "canceled_returned"),
      delivered: await seed.parcelFor(seed.riderAId, "delivered"),
      returned: await seed.parcelFor(seed.riderAId, "returned_to_merchant"),
    };
    const bParcel = await seed.parcelFor(seed.riderBId, "on_the_way");
    const unassigned = await seed.parcelFor(undefined, "at_office");

    return { riderAUserId: seed.riderAUserId, aParcels, bParcel, unassigned };
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
    session.signInAs(riderAUserId);

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
    session.signInAs(riderAUserId);

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
