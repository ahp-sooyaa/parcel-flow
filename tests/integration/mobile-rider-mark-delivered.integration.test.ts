import { beforeEach, describe, expect, mock, test } from "bun:test";
import { eq } from "drizzle-orm";

import { parcels } from "@/db/schema";
import { mobileMarkDeliveredResponseSchema } from "@/features/mobile-api/contract";
import { ParcelOperationError } from "@/features/parcels/server/errors";
import {
  mockMobileRiderSession,
  seedTwoRiders,
  useMobileRiderTestDb,
} from "../fixtures/mobile-rider";

// The real operation, DAL and database run. The session lookup is stubbed so
// each test picks the rider, and R2 uploads are stubbed to a fixed key.
const session = await mockMobileRiderSession();
const uploadedKeys: string[] = [];
const actualUpload = await import("@/features/parcels/server/upload");

void mock.module("@/features/parcels/server/upload", () => ({
  ...actualUpload,
  uploadDeliveryProofImage: async ({ parcelId }: { parcelId: string }) => {
    const key = `parcels/${parcelId}/proof-of-delivery/test.jpg`;
    uploadedKeys.push(key);
    return key;
  },
  deleteDeliveryProofImage: async () => undefined,
}));

describe("mobile rider mark delivered integration", async () => {
  const { testDb, seededIds } = useMobileRiderTestDb(session);
  const { POST } = await import("@/app/api/mobile/v1/rider/parcels/[parcelId]/deliver/route");
  const { markRiderParcelDelivered } = await import("@/features/parcels/server/dal");

  beforeEach(() => {
    uploadedKeys.length = 0;
  });

  async function seedTwoRiderParcels() {
    const seed = await seedTwoRiders(testDb, seededIds);

    return {
      riderAId: seed.riderAId,
      riderAUserId: seed.riderAUserId,
      aOnTheWay: await seed.parcelFor(seed.riderAId, "on_the_way"),
      aAtOffice: await seed.parcelFor(seed.riderAId, "at_office"),
      aWithFailureNote: await seed.parcelFor(seed.riderAId, "on_the_way", {
        deliveryFailureNote: "Receiver not home",
      }),
      bOnTheWay: await seed.parcelFor(seed.riderBId, "on_the_way"),
    };
  }

  function deliver(parcelId: string) {
    const body = new FormData();
    body.set("proofImage", new File([new Uint8Array(512)], "proof.jpg", { type: "image/jpeg" }));

    return POST(
      new Request(`http://localhost:3000/api/mobile/v1/rider/parcels/${parcelId}/deliver`, {
        method: "POST",
        body,
      }),
      { params: Promise.resolve({ parcelId }) },
    );
  }

  async function parcelRow(parcelId: string) {
    const [row] = await testDb.db
      .select({
        status: parcels.status,
        collectedAmount: parcels.collectedAmount,
        codStatus: parcels.codStatus,
        proofOfDeliveryImagesKeys: parcels.proofOfDeliveryImagesKeys,
      })
      .from(parcels)
      .where(eq(parcels.id, parcelId));
    return row;
  }

  test("the rider's on-the-way COD parcel is delivered with its photo key", async () => {
    const seed = await seedTwoRiderParcels();
    session.signInAs(seed.riderAUserId);

    const response = await deliver(seed.aOnTheWay.id);

    expect(response.status).toBe(200);
    expect(mobileMarkDeliveredResponseSchema.parse(await response.json()).data).toEqual({
      parcelId: seed.aOnTheWay.id,
    });
    expect(await parcelRow(seed.aOnTheWay.id)).toEqual({
      status: "delivered",
      collectedAmount: 23_000,
      codStatus: "collected",
      proofOfDeliveryImagesKeys: [`parcels/${seed.aOnTheWay.id}/proof-of-delivery/test.jpg`],
    });
  });

  test("another rider's parcel is a 404, with no upload and no change", async () => {
    const seed = await seedTwoRiderParcels();
    session.signInAs(seed.riderAUserId);

    const response = await deliver(seed.bOnTheWay.id);

    expect(response.status).toBe(404);
    expect(uploadedKeys).toHaveLength(0);
    expect((await parcelRow(seed.bOnTheWay.id))?.status).toBe("on_the_way");
  });

  test("an at-office parcel is a 409", async () => {
    const seed = await seedTwoRiderParcels();
    session.signInAs(seed.riderAUserId);

    expect((await deliver(seed.aAtOffice.id)).status).toBe(409);
    expect(uploadedKeys).toHaveLength(0);
  });

  test("a parcel with an active failure note is a 409, with no upload and no change", async () => {
    const seed = await seedTwoRiderParcels();
    session.signInAs(seed.riderAUserId);

    const response = await deliver(seed.aWithFailureNote.id);

    expect(response.status).toBe(409);
    expect(uploadedKeys).toHaveLength(0);
    expect((await parcelRow(seed.aWithFailureNote.id))?.status).toBe("on_the_way");
  });

  test("the DAL itself rejects delivery while a failure note is active", async () => {
    const seed = await seedTwoRiderParcels();

    const error: unknown = await markRiderParcelDelivered({
      parcelId: seed.aWithFailureNote.id,
      proofImageKey: "parcels/x/proof.jpg",
      riderUserId: seed.riderAUserId,
      actorRole: "rider",
      createdBy: seed.riderAUserId,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ParcelOperationError);
    expect(error).toMatchObject({ code: "conflict" });
    expect((await parcelRow(seed.aWithFailureNote.id))?.status).toBe("on_the_way");
  });
});
