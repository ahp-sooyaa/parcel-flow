import { describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { financialItems, parcels } from "@/db/schema";
import {
  mobileRiderParcelDetailResponseSchema,
  mobileReturnToMerchantResponseSchema,
} from "@/features/mobile-api/contract";
import { ParcelOperationError } from "@/features/parcels/server/errors";
import {
  mockMobileRiderSession,
  seedTwoRiders,
  useMobileRiderTestDb,
} from "../fixtures/mobile-rider";

// The real operation, DAL and database run; the session lookup is stubbed so
// each test picks the rider.
const session = await mockMobileRiderSession();

describe("mobile rider return to merchant integration", async () => {
  const { testDb, seededIds } = useMobileRiderTestDb(session);
  const { POST } = await import("@/app/api/mobile/v1/rider/parcels/[parcelId]/return/route");
  const { GET: getDetail } = await import("@/app/api/mobile/v1/rider/parcels/[parcelId]/route");
  const { markRiderParcelReturnedToMerchant } = await import("@/features/parcels/server/dal");

  async function seedReturnParcels() {
    const seed = await seedTwoRiders(testDb, seededIds);

    return {
      riderAId: seed.riderAId,
      riderAUserId: seed.riderAUserId,
      merchant: seed.merchant,
      aReturn: await seed.parcelFor(seed.riderAId, "canceled_returned"),
      aOnTheWay: await seed.parcelFor(seed.riderAId, "on_the_way"),
      bReturn: await seed.parcelFor(seed.riderBId, "canceled_returned"),
    };
  }

  function returnParcel(parcelId: string) {
    return POST(
      new Request(`http://localhost:3000/api/mobile/v1/rider/parcels/${parcelId}/return`, {
        method: "POST",
      }),
      { params: Promise.resolve({ parcelId }) },
    );
  }

  async function detail(parcelId: string) {
    const response = await getDetail(new Request("http://localhost"), {
      params: Promise.resolve({ parcelId }),
    });
    return mobileRiderParcelDetailResponseSchema.parse(await response.json()).data;
  }

  async function parcelRow(parcelId: string) {
    const [row] = await testDb.db
      .select({ status: parcels.status, returnedToMerchantAt: parcels.returnedToMerchantAt })
      .from(parcels)
      .where(eq(parcels.id, parcelId));
    return row;
  }

  async function itemsFor(parcelId: string) {
    return testDb.db
      .select({
        itemType: financialItems.itemType,
        riderWaySource: financialItems.riderWaySource,
        riderId: financialItems.riderId,
        amount: financialItems.amount,
      })
      .from(financialItems)
      .where(eq(financialItems.parcelId, parcelId));
  }

  test("the rider's return is completed once, with its financial items", async () => {
    const seed = await seedReturnParcels();
    session.signInAs(seed.riderAUserId);

    const response = await returnParcel(seed.aReturn.id);

    expect(response.status).toBe(200);
    expect(mobileReturnToMerchantResponseSchema.parse(await response.json()).data).toEqual({
      parcelId: seed.aReturn.id,
    });
    const row = await parcelRow(seed.aReturn.id);
    expect(row?.status).toBe("returned_to_merchant");
    expect(row?.returnedToMerchantAt).toBeInstanceOf(Date);

    const items = await itemsFor(seed.aReturn.id);
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ itemType: "delivery_fee_deduction", amount: 3_000 }),
        expect.objectContaining({
          itemType: "rider_way_payout",
          riderWaySource: "merchant_return",
          riderId: seed.riderAId,
          amount: 1,
        }),
      ]),
    );

    expect((await returnParcel(seed.aReturn.id)).status).toBe(409);
    expect(await itemsFor(seed.aReturn.id)).toHaveLength(items.length);
  });

  test("another rider's return is a 404, and an on-the-way parcel a 409", async () => {
    const seed = await seedReturnParcels();
    session.signInAs(seed.riderAUserId);

    expect((await returnParcel(seed.bReturn.id)).status).toBe(404);
    expect((await returnParcel(seed.aOnTheWay.id)).status).toBe(409);
    expect((await parcelRow(seed.bReturn.id))?.status).toBe("canceled_returned");
    expect((await parcelRow(seed.aOnTheWay.id))?.status).toBe("on_the_way");
  });

  test("only a return's detail carries the merchant's contact", async () => {
    const seed = await seedReturnParcels();
    session.signInAs(seed.riderAUserId);

    expect((await detail(seed.aReturn.id)).merchantReturnContact).toEqual({
      address: seed.merchant.address,
      phoneNumber: seed.merchant.phoneNumber,
    });
    expect((await detail(seed.aOnTheWay.id)).merchantReturnContact).toBeNull();
  });

  test("the DAL throws typed errors", async () => {
    const seed = await seedReturnParcels();

    const notAssigned: unknown = await markRiderParcelReturnedToMerchant({
      parcelId: seed.bReturn.id,
      riderUserId: seed.riderAUserId,
      actorRole: "rider",
      createdBy: seed.riderAUserId,
    }).catch((caught: unknown) => caught);
    const notAwaitingReturn: unknown = await markRiderParcelReturnedToMerchant({
      parcelId: seed.aOnTheWay.id,
      riderUserId: seed.riderAUserId,
      actorRole: "rider",
      createdBy: seed.riderAUserId,
    }).catch((caught: unknown) => caught);

    expect(notAssigned).toBeInstanceOf(ParcelOperationError);
    expect(notAssigned).toMatchObject({ code: "not_assigned" });
    expect(notAwaitingReturn).toBeInstanceOf(ParcelOperationError);
    expect(notAwaitingReturn).toMatchObject({ code: "conflict" });
  });
});
