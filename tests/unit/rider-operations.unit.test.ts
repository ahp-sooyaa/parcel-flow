import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

import { ParcelOperationError } from "@/features/parcels/server/errors";
import type { ParcelListItemDto } from "@/features/parcels/server/dto";
import { buildCurrentUser, buildParcelListItem } from "../fixtures/builders";

const startDeliveryForRiderParcelsMock = mock(async (): Promise<void> => undefined);
const markRiderParcelDeliveredMock = mock(async (): Promise<void> => undefined);
const getParcelByIdForRealtimeScopeMock = mock(async (): Promise<ParcelListItemDto | null> => null);
const uploadDeliveryProofImageMock = mock(async (): Promise<string> => "parcels/p/proof.jpg");
const deleteDeliveryProofImageMock = mock(async (): Promise<void> => undefined);
const revalidatePathMock = mock(() => undefined);
const revalidateTagMock = mock(() => undefined);
const updateTagMock = mock(() => undefined);

// Bun keeps module mocks for later test files, so keep the real exports.
const actualNextCache = await import("next/cache");
const actualParcelsDal = await import("@/features/parcels/server/dal");
const actualUpload = await import("@/features/parcels/server/upload");

void mock.module("next/cache", () => ({
  ...actualNextCache,
  revalidatePath: revalidatePathMock,
  revalidateTag: revalidateTagMock,
  updateTag: updateTagMock,
}));

void mock.module("@/features/parcels/server/dal", () => ({
  ...actualParcelsDal,
  startDeliveryForRiderParcels: startDeliveryForRiderParcelsMock,
  markRiderParcelDelivered: markRiderParcelDeliveredMock,
  getParcelByIdForRealtimeScope: getParcelByIdForRealtimeScopeMock,
}));

void mock.module("@/features/parcels/server/upload", () => ({
  ...actualUpload,
  uploadDeliveryProofImage: uploadDeliveryProofImageMock,
  deleteDeliveryProofImage: deleteDeliveryProofImageMock,
}));

const riderUserId = "8b3c5d4e-1111-4a2b-9c3d-000000000001";
const parcelA = "0f7a3c2e-2222-4b1c-8d9e-000000000002";
const parcelB = "0f7a3c2e-2222-4b1c-8d9e-000000000003";
const rider = buildCurrentUser({ id: riderUserId, role: "rider" });

describe("startRiderDelivery", async () => {
  const { MAX_START_DELIVERY_PARCELS, startRiderDelivery } =
    await import("@/features/parcels/server/rider-operations");
  const { revalidateParcelWriteCaches } = await import("@/lib/cache-invalidation");

  beforeEach(() => {
    startDeliveryForRiderParcelsMock.mockReset();
    startDeliveryForRiderParcelsMock.mockResolvedValue(undefined);
    revalidatePathMock.mockReset();
    revalidateTagMock.mockReset();
    updateTagMock.mockReset();
  });

  test.each([
    [{ parcelIds: [] }, "Select at least one parcel."],
    [{ parcelIds: ["not-a-uuid"] }, "Invalid parcel selection."],
    [
      {
        parcelIds: Array.from(
          { length: MAX_START_DELIVERY_PARCELS + 1 },
          (_, index) => `0f7a3c2e-2222-4b1c-8d9e-${String(index).padStart(12, "0")}`,
        ),
      },
      "Select up to 50 parcels at a time.",
    ],
    [null, "Invalid input: expected object, received null"],
  ])("rejects invalid input %#", async (input, message) => {
    const result = await startRiderDelivery(rider, input, { caller: "route-handler" });

    expect(result).toEqual({ ok: false, reason: "invalid", message });
    expect(startDeliveryForRiderParcelsMock).not.toHaveBeenCalled();
  });

  test("rejects non-rider actors before the DAL", async () => {
    const admin = buildCurrentUser({ role: "office_admin" });

    const result = await startRiderDelivery(
      admin,
      { parcelIds: [parcelA] },
      { caller: "route-handler" },
    );

    expect(result).toEqual({
      ok: false,
      reason: "forbidden",
      message: "You do not have permission to start delivery.",
    });
    expect(startDeliveryForRiderParcelsMock).not.toHaveBeenCalled();
  });

  test("starts de-duplicated parcels and expires caches for route handlers", async () => {
    const result = await startRiderDelivery(
      rider,
      { parcelIds: [parcelA, parcelB, parcelA] },
      { caller: "route-handler" },
    );

    expect(result).toEqual({
      ok: true,
      message: "Selected parcels moved to on the way.",
      parcelIds: [parcelA, parcelB],
    });
    expect(startDeliveryForRiderParcelsMock).toHaveBeenCalledWith({
      parcelIds: [parcelA, parcelB],
      riderUserId,
      actorRole: "rider",
    });
    expect(revalidateTagMock).toHaveBeenCalledWith(`rider-parcels:${riderUserId}`, { expire: 0 });
    expect(revalidateTagMock).toHaveBeenCalledWith("parcels", { expire: 0 });
    expect(updateTagMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/rider/parcels");
  });

  test("uses updateTag for server actions", async () => {
    await startRiderDelivery(rider, { parcelIds: [parcelA] }, { caller: "server-action" });

    expect(updateTagMock).toHaveBeenCalledWith(`rider-parcels:${riderUserId}`);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  test.each([
    ["forbidden", "forbidden"],
    ["not_found", "not_found"],
    ["not_assigned", "not_found"],
    ["conflict", "conflict"],
  ] as const)("maps the %s DAL error to %s", async (code, reason) => {
    startDeliveryForRiderParcelsMock.mockRejectedValue(
      new ParcelOperationError(code, "Rule message."),
    );

    const result = await startRiderDelivery(
      rider,
      { parcelIds: [parcelA] },
      { caller: "route-handler" },
    );

    expect(result).toEqual({ ok: false, reason, message: "Rule message." });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  test("reports unexpected errors as failed", async () => {
    startDeliveryForRiderParcelsMock.mockRejectedValue(new Error("connection reset"));

    const result = await startRiderDelivery(
      rider,
      { parcelIds: [parcelA] },
      { caller: "route-handler" },
    );

    expect(result).toEqual({ ok: false, reason: "failed", message: "connection reset" });
  });

  test("revalidateParcelWriteCaches keeps stale-while-revalidate by default", () => {
    revalidateParcelWriteCaches({ riderUserId });

    expect(revalidateTagMock).toHaveBeenCalledWith(`rider-parcels:${riderUserId}`, "max");
    expect(revalidateTagMock).not.toHaveBeenCalledWith(expect.anything(), { expire: 0 });
  });
});

function photo(type = "image/jpeg", size = 1024) {
  return new File([new Uint8Array(size)], "proof.jpg", { type });
}

describe("markRiderParcelDelivered operation", async () => {
  const { markRiderParcelDelivered, MAX_PROOF_IMAGE_BYTES, PROOF_IMAGE_TYPES } =
    await import("@/features/parcels/server/rider-operations");
  const { MOBILE_PROOF_IMAGE_MAX_BYTES, mobileProofImageTypes } =
    await import("@/features/mobile-api/contract");
  const originalDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE;
  let photoCount = 0;

  // A fresh rider per test keeps the demo rate limiter's per-user budget apart.
  function freshRider() {
    photoCount += 1;
    return buildCurrentUser({
      id: `8b3c5d4e-1111-4a2b-9c3d-${String(photoCount).padStart(12, "0")}`,
      role: "rider",
    });
  }

  const onTheWay = buildParcelListItem({ id: parcelA, status: "on_the_way" });

  beforeEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = originalDemoMode;
    markRiderParcelDeliveredMock.mockReset();
    markRiderParcelDeliveredMock.mockResolvedValue(undefined);
    getParcelByIdForRealtimeScopeMock.mockReset();
    getParcelByIdForRealtimeScopeMock.mockResolvedValue(onTheWay);
    uploadDeliveryProofImageMock.mockReset();
    uploadDeliveryProofImageMock.mockResolvedValue("parcels/p/proof.jpg");
    deleteDeliveryProofImageMock.mockReset();
    deleteDeliveryProofImageMock.mockResolvedValue(undefined);
    revalidatePathMock.mockReset();
    revalidateTagMock.mockReset();
    updateTagMock.mockReset();
  });

  test("the server photo limits match the mobile contract", () => {
    expect(MAX_PROOF_IMAGE_BYTES).toBe(MOBILE_PROOF_IMAGE_MAX_BYTES);
    expect([...PROOF_IMAGE_TYPES]).toEqual([...mobileProofImageTypes]);
  });

  test("rejects non-rider actors", async () => {
    const result = await markRiderParcelDelivered(buildCurrentUser({ role: "merchant" }), {
      parcelId: parcelA,
      proofImage: photo(),
    });

    expect(result).toMatchObject({ ok: false, reason: "forbidden" });
    expect(uploadDeliveryProofImageMock).not.toHaveBeenCalled();
  });

  test.each([
    [{ parcelId: parcelA, proofImage: null }, "Delivery proof photo is required."],
    [
      { parcelId: parcelA, proofImage: photo("image/jpeg", MAX_PROOF_IMAGE_BYTES + 1) },
      "Delivery proof photo must be 5MB or smaller.",
    ],
    [
      { parcelId: parcelA, proofImage: photo("image/gif") },
      "Delivery proof photo must be a JPG, PNG, or WebP image.",
    ],
    [{ parcelId: "nope", proofImage: photo() }, "Invalid parcel selection."],
  ])("rejects invalid input %#", async (input, message) => {
    const result = await markRiderParcelDelivered(freshRider(), input);

    expect(result).toEqual({ ok: false, reason: "invalid", message });
    expect(getParcelByIdForRealtimeScopeMock).not.toHaveBeenCalled();
  });

  test.each([
    [null, "not_found", "Parcel was not found."],
    [
      buildParcelListItem({ id: parcelA, status: "at_office" }),
      "conflict",
      "Only on-the-way parcels can be marked delivered.",
    ],
    [
      buildParcelListItem({
        id: parcelA,
        status: "on_the_way",
        activeFailureNote: { note: "Receiver not home", status: "active" },
      }),
      "conflict",
      "Resolve the delivery failure note before marking this parcel delivered.",
    ],
  ] as const)(
    "rejects an ineligible parcel before uploading %#",
    async (parcel, reason, message) => {
      getParcelByIdForRealtimeScopeMock.mockResolvedValue(parcel);
      const actor = freshRider();

      const result = await markRiderParcelDelivered(actor, {
        parcelId: parcelA,
        proofImage: photo(),
      });

      expect(result).toEqual({ ok: false, reason, message });
      expect(getParcelByIdForRealtimeScopeMock).toHaveBeenCalledWith(parcelA, {
        role: "rider",
        userId: actor.id,
      });
      expect(uploadDeliveryProofImageMock).not.toHaveBeenCalled();
      expect(markRiderParcelDeliveredMock).not.toHaveBeenCalled();
    },
  );

  test("uploads, saves, and expires caches immediately", async () => {
    const actor = freshRider();
    const proofImage = photo();

    const result = await markRiderParcelDelivered(actor, { parcelId: parcelA, proofImage });

    expect(result).toEqual({ ok: true, message: "Parcel marked delivered.", parcelId: parcelA });
    expect(uploadDeliveryProofImageMock).toHaveBeenCalledWith({
      parcelId: parcelA,
      file: proofImage,
    });
    expect(markRiderParcelDeliveredMock).toHaveBeenCalledWith({
      parcelId: parcelA,
      proofImageKey: "parcels/p/proof.jpg",
      riderUserId: actor.id,
      actorRole: "rider",
      createdBy: actor.id,
    });
    expect(revalidateTagMock).toHaveBeenCalledWith(`rider-parcels:${actor.id}`, { expire: 0 });
    expect(updateTagMock).not.toHaveBeenCalled();
  });

  test("uses a sample photo without uploading in demo mode", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "1";

    const result = await markRiderParcelDelivered(freshRider(), {
      parcelId: parcelA,
      proofImage: null,
    });

    expect(result.ok).toBe(true);
    expect(uploadDeliveryProofImageMock).not.toHaveBeenCalled();
    expect(markRiderParcelDeliveredMock).toHaveBeenCalled();
  });

  test("rate limits deliveries in demo mode", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "1";
    const actor = freshRider();
    const results = [];

    for (let index = 0; index < 31; index += 1) {
      results.push(await markRiderParcelDelivered(actor, { parcelId: parcelA, proofImage: null }));
    }

    expect(results.at(-1)).toMatchObject({ ok: false, reason: "rate_limited" });
  });

  test.each([
    ["not_assigned", "not_found"],
    ["conflict", "conflict"],
  ] as const)("deletes the uploaded photo when the DAL rejects with %s", async (code, reason) => {
    markRiderParcelDeliveredMock.mockRejectedValue(new ParcelOperationError(code, "Rule message."));

    const result = await markRiderParcelDelivered(freshRider(), {
      parcelId: parcelA,
      proofImage: photo(),
    });

    expect(result).toEqual({ ok: false, reason, message: "Rule message." });
    expect(deleteDeliveryProofImageMock).toHaveBeenCalledWith("parcels/p/proof.jpg");
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  test("a failed photo delete doesn't hide the delivery failure", async () => {
    markRiderParcelDeliveredMock.mockRejectedValue(new Error("connection reset"));
    deleteDeliveryProofImageMock.mockRejectedValue(new Error("R2 down"));
    const consoleError = spyOn(console, "error").mockImplementation(() => undefined);

    const result = await markRiderParcelDelivered(freshRider(), {
      parcelId: parcelA,
      proofImage: photo(),
    });

    expect(result).toEqual({ ok: false, reason: "failed", message: "connection reset" });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  test("reports an upload failure without saving", async () => {
    uploadDeliveryProofImageMock.mockRejectedValue(new Error("R2 credentials"));

    const result = await markRiderParcelDelivered(freshRider(), {
      parcelId: parcelA,
      proofImage: photo(),
    });

    expect(result).toEqual({
      ok: false,
      reason: "failed",
      message: "Couldn't save the delivery photo. Try again.",
    });
    expect(markRiderParcelDeliveredMock).not.toHaveBeenCalled();
  });
});
