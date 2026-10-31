import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { eq } from "drizzle-orm";

import { parcels } from "@/db/schema";
import { mobileMarkDeliveredResponseSchema } from "@/features/mobile-api/contract";
import { ParcelOperationError } from "@/features/parcels/server/errors";
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

// The real operation, DAL and database run. The session lookup is stubbed so
// each test picks the rider, and R2 uploads are stubbed to a fixed key.
let sessionUserId: string | null = null;
const uploadedKeys: string[] = [];

void mock.module("next/headers", () => ({
  headers: async () => new Headers(),
}));

// Bun keeps module mocks for later test files, so keep the real exports
// (mobile-auth.integration.test.ts needs the real `auth.handler` and sessions).
// Capture them before mocking: the module namespace is live and gets patched.
const actualAuth = { ...(await import("@/lib/auth")) };
const realAuth = actualAuth.auth;
const realGetSession = realAuth.api.getSession.bind(realAuth.api);
const actualUpload = await import("@/features/parcels/server/upload");

void mock.module("@/lib/auth", () => ({
  ...actualAuth,
  auth: {
    ...realAuth,
    api: {
      ...realAuth.api,
      getSession: async (...args: Parameters<typeof realGetSession>) =>
        sessionUserId
          ? buildSessionUser({ id: sessionUserId, role: "rider" })
          : realGetSession(...args),
    },
  },
}));

void mock.module("@/features/parcels/server/upload", () => ({
  ...actualUpload,
  uploadDeliveryProofImage: async ({ parcelId }: { parcelId: string }) => {
    const key = `parcels/${parcelId}/proof-of-delivery/test.jpg`;
    uploadedKeys.push(key);
    return key;
  },
  deleteDeliveryProofImage: async () => undefined,
}));

const seededIds = {
  userIds: [] as string[],
  merchantIds: [] as string[],
  riderIds: [] as string[],
  townshipIds: [] as string[],
  parcelIds: [] as string[],
};

describe("mobile rider mark delivered integration", async () => {
  const testDb = createTestDatabase();
  const { POST } = await import("@/app/api/mobile/v1/rider/parcels/[parcelId]/deliver/route");
  const { markRiderParcelDelivered } = await import("@/features/parcels/server/dal");

  beforeEach(() => {
    uploadedKeys.length = 0;
  });

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

    async function parcelFor(
      riderId: string,
      status: ParcelStatus,
      deliveryFailureNote: string | null = null,
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
        deliveryFailureNote,
      });
      seededIds.parcelIds.push(parcel.id);
      return parcel;
    }

    return {
      riderAUserId: riderA.user?.id ?? "",
      aOnTheWay: await parcelFor(riderA.rider.id, "on_the_way"),
      aAtOffice: await parcelFor(riderA.rider.id, "at_office"),
      aWithFailureNote: await parcelFor(riderA.rider.id, "on_the_way", "Receiver not home"),
      bOnTheWay: await parcelFor(riderB.rider.id, "on_the_way"),
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
    const seed = await seedTwoRiders();
    sessionUserId = seed.riderAUserId;

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
    const seed = await seedTwoRiders();
    sessionUserId = seed.riderAUserId;

    const response = await deliver(seed.bOnTheWay.id);

    expect(response.status).toBe(404);
    expect(uploadedKeys).toHaveLength(0);
    expect((await parcelRow(seed.bOnTheWay.id))?.status).toBe("on_the_way");
  });

  test("an at-office parcel is a 409", async () => {
    const seed = await seedTwoRiders();
    sessionUserId = seed.riderAUserId;

    expect((await deliver(seed.aAtOffice.id)).status).toBe(409);
    expect(uploadedKeys).toHaveLength(0);
  });

  test("a parcel with an active failure note is a 409, with no upload and no change", async () => {
    const seed = await seedTwoRiders();
    sessionUserId = seed.riderAUserId;

    const response = await deliver(seed.aWithFailureNote.id);

    expect(response.status).toBe(409);
    expect(uploadedKeys).toHaveLength(0);
    expect((await parcelRow(seed.aWithFailureNote.id))?.status).toBe("on_the_way");
  });

  test("the DAL itself rejects delivery while a failure note is active", async () => {
    const seed = await seedTwoRiders();

    const attempt = markRiderParcelDelivered({
      parcelId: seed.aWithFailureNote.id,
      proofImageKey: "parcels/x/proof.jpg",
      riderUserId: seed.riderAUserId,
      actorRole: "rider",
      createdBy: seed.riderAUserId,
    });

    expect(attempt).rejects.toBeInstanceOf(ParcelOperationError);
    expect(attempt).rejects.toMatchObject({ code: "conflict" });
    await attempt.catch(() => undefined);
    expect((await parcelRow(seed.aWithFailureNote.id))?.status).toBe("on_the_way");
  });
});
