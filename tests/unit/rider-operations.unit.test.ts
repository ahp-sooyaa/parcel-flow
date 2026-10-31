import { beforeEach, describe, expect, mock, test } from "bun:test";

import { ParcelOperationError } from "@/features/parcels/server/errors";
import { buildCurrentUser } from "../fixtures/builders";

const startDeliveryForRiderParcelsMock = mock(async (): Promise<void> => undefined);
const revalidatePathMock = mock(() => undefined);
const revalidateTagMock = mock(() => undefined);
const updateTagMock = mock(() => undefined);

// Bun keeps module mocks for later test files, so keep the real exports.
const actualNextCache = await import("next/cache");
const actualParcelsDal = await import("@/features/parcels/server/dal");

void mock.module("next/cache", () => ({
  ...actualNextCache,
  revalidatePath: revalidatePathMock,
  revalidateTag: revalidateTagMock,
  updateTag: updateTagMock,
}));

void mock.module("@/features/parcels/server/dal", () => ({
  ...actualParcelsDal,
  startDeliveryForRiderParcels: startDeliveryForRiderParcelsMock,
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
