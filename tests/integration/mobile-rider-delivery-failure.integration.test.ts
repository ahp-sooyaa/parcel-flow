import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";
import { eq } from "drizzle-orm";

import { financialItems, parcels } from "@/db/schema";
import { mobileFailureNoteResponseSchema } from "@/features/mobile-api/contract";
import { ParcelOperationError } from "@/features/parcels/server/errors";
import { buildCurrentUser } from "../fixtures/builders";
import { cleanupTestRecords } from "../fixtures/cleanup";
import { closeTestDatabase, createTestDatabase } from "../fixtures/db";
import { createSeededIds, mockMobileRiderSession, seedTwoRiders } from "../fixtures/mobile-rider";

// The real operations, DAL and database run. The session lookup is stubbed so
// each test picks the rider, and R2 uploads are stubbed for the delivery check.
const session = await mockMobileRiderSession();
const actualUpload = await import("@/features/parcels/server/upload");

void mock.module("@/features/parcels/server/upload", () => ({
  ...actualUpload,
  uploadDeliveryProofImage: async ({ parcelId }: { parcelId: string }) =>
    `parcels/${parcelId}/proof-of-delivery/test.jpg`,
  deleteDeliveryProofImage: async () => undefined,
}));

const seededIds = createSeededIds();

describe("mobile rider delivery failure integration", async () => {
  const testDb = createTestDatabase();
  const route = await import("@/app/api/mobile/v1/rider/parcels/[parcelId]/failure-note/route");
  const { markRiderParcelDelivered } = await import("@/features/parcels/server/rider-operations");
  const { deleteDeliveryFailureForRiderParcel, reportDeliveryFailureForRiderParcel } =
    await import("@/features/parcels/server/dal");

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

  async function seedTwoRiderParcels() {
    const seed = await seedTwoRiders(testDb, seededIds);

    return {
      riderAId: seed.riderAId,
      riderAUserId: seed.riderAUserId,
      aOnTheWay: await seed.parcelFor(seed.riderAId, "on_the_way"),
      aAtOffice: await seed.parcelFor(seed.riderAId, "at_office"),
      aWithHistory: await seed.parcelFor(seed.riderAId, "on_the_way", [
        { note: "Resolved earlier.", status: "inactive" },
        { note: "Receiver not home.", status: "active" },
      ]),
      bOnTheWay: await seed.parcelFor(seed.riderBId, "on_the_way"),
    };
  }

  function send(method: "POST" | "PATCH" | "DELETE", parcelId: string, note?: string) {
    return route[method](
      new Request(`http://localhost:3000/api/mobile/v1/rider/parcels/${parcelId}/failure-note`, {
        method,
        ...(note !== undefined && {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note }),
        }),
      }),
      { params: Promise.resolve({ parcelId }) },
    );
  }

  async function parcelRow(parcelId: string) {
    const [row] = await testDb.db
      .select({
        status: parcels.status,
        riderId: parcels.riderId,
        deliveredAt: parcels.deliveredAt,
        collectedAmount: parcels.collectedAmount,
        deliveryFailureNote: parcels.deliveryFailureNote,
      })
      .from(parcels)
      .where(eq(parcels.id, parcelId));
    return row;
  }

  async function financialItemCount(parcelId: string) {
    const rows = await testDb.db
      .select({ id: financialItems.id })
      .from(financialItems)
      .where(eq(financialItems.parcelId, parcelId));
    return rows.length;
  }

  test("report, edit and delete a note, then deliver the parcel", async () => {
    const seed = await seedTwoRiderParcels();
    session.signInAs(seed.riderAUserId);
    const before = await parcelRow(seed.aOnTheWay.id);
    const itemsBefore = await financialItemCount(seed.aOnTheWay.id);

    const reported = await send("POST", seed.aOnTheWay.id, "  Receiver didn't answer.  ");

    expect(reported.status).toBe(200);
    expect(mobileFailureNoteResponseSchema.parse(await reported.json()).data).toEqual({
      parcelId: seed.aOnTheWay.id,
      activeFailureNote: "Receiver didn't answer.",
    });
    expect(await parcelRow(seed.aOnTheWay.id)).toEqual({
      ...before,
      deliveryFailureNote: [{ note: "Receiver didn't answer.", status: "active" }],
    });
    expect(await financialItemCount(seed.aOnTheWay.id)).toBe(itemsBefore);

    expect((await send("POST", seed.aOnTheWay.id, "Again.")).status).toBe(409);

    const edited = await send("PATCH", seed.aOnTheWay.id, "Wrong address.");

    expect(edited.status).toBe(200);
    expect((await parcelRow(seed.aOnTheWay.id))?.deliveryFailureNote).toEqual([
      { note: "Wrong address.", status: "active" },
    ]);

    const deleted = await send("DELETE", seed.aOnTheWay.id);

    expect(deleted.status).toBe(200);
    expect(mobileFailureNoteResponseSchema.parse(await deleted.json()).data).toEqual({
      parcelId: seed.aOnTheWay.id,
      activeFailureNote: null,
    });
    expect((await parcelRow(seed.aOnTheWay.id))?.deliveryFailureNote).toBeNull();
    expect((await send("DELETE", seed.aOnTheWay.id)).status).toBe(409);

    const delivered = await markRiderParcelDelivered(
      buildCurrentUser({ id: seed.riderAUserId, role: "rider" }),
      {
        parcelId: seed.aOnTheWay.id,
        proofImage: new File([new Uint8Array(512)], "proof.jpg", { type: "image/jpeg" }),
      },
    );

    expect(delivered.ok).toBe(true);
    expect((await parcelRow(seed.aOnTheWay.id))?.status).toBe("delivered");
  });

  test("deleting the active note keeps inactive history", async () => {
    const seed = await seedTwoRiderParcels();
    session.signInAs(seed.riderAUserId);

    expect((await send("DELETE", seed.aWithHistory.id)).status).toBe(200);
    expect((await parcelRow(seed.aWithHistory.id))?.deliveryFailureNote).toEqual([
      { note: "Resolved earlier.", status: "inactive" },
    ]);
  });

  test("another rider's parcel is a 404 for every verb, with no change", async () => {
    const seed = await seedTwoRiderParcels();
    session.signInAs(seed.riderAUserId);

    expect((await send("POST", seed.bOnTheWay.id, "Not mine.")).status).toBe(404);
    expect((await send("PATCH", seed.bOnTheWay.id, "Not mine.")).status).toBe(404);
    expect((await send("DELETE", seed.bOnTheWay.id)).status).toBe(404);
    expect((await parcelRow(seed.bOnTheWay.id))?.deliveryFailureNote).toBeNull();
  });

  test("an at-office parcel, or editing without a note, is a 409", async () => {
    const seed = await seedTwoRiderParcels();
    session.signInAs(seed.riderAUserId);

    expect((await send("POST", seed.aAtOffice.id, "Too early.")).status).toBe(409);
    expect((await send("PATCH", seed.aOnTheWay.id, "No note yet.")).status).toBe(409);
    expect((await send("DELETE", seed.aOnTheWay.id)).status).toBe(409);
    expect((await parcelRow(seed.aAtOffice.id))?.deliveryFailureNote).toBeNull();
  });

  test("the DAL throws typed errors", async () => {
    const seed = await seedTwoRiderParcels();

    const notAssigned: unknown = await reportDeliveryFailureForRiderParcel({
      parcelId: seed.bOnTheWay.id,
      note: "Not mine.",
      riderUserId: seed.riderAUserId,
      actorRole: "rider",
    }).catch((caught: unknown) => caught);
    const noNote: unknown = await deleteDeliveryFailureForRiderParcel({
      parcelId: seed.aOnTheWay.id,
      riderUserId: seed.riderAUserId,
      actorRole: "rider",
    }).catch((caught: unknown) => caught);

    expect(notAssigned).toBeInstanceOf(ParcelOperationError);
    expect(notAssigned).toMatchObject({ code: "not_assigned" });
    expect(noNote).toBeInstanceOf(ParcelOperationError);
    expect(noNote).toMatchObject({ code: "conflict" });
  });
});
