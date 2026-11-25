import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  mobileErrorResponseSchema,
  mobileReturnToMerchantResponseSchema,
} from "@/features/mobile-api/contract";
import { ParcelOperationError } from "@/features/parcels/server/errors";
import { mockMobileRouteSession } from "../fixtures/mobile-route-session";

const riderId = "8b3c5d4e-1111-4a2b-9c3d-000000000001";
const session = mockMobileRouteSession(riderId);
const markRiderParcelReturnedMock = mock(async (): Promise<void> => undefined);
const revalidateTagMock = mock(() => undefined);

// Bun keeps module mocks for later test files, so keep the real exports.
const actualNextCache = await import("next/cache");
const actualParcelsDal = await import("@/features/parcels/server/dal");

void mock.module("next/cache", () => ({
  ...actualNextCache,
  revalidateTag: revalidateTagMock,
}));

void mock.module("@/features/parcels/server/dal", () => ({
  ...actualParcelsDal,
  markRiderParcelReturnedToMerchant: markRiderParcelReturnedMock,
}));

const parcelId = "0f7a3c2e-2222-4b1c-8d9e-000000000002";

async function errorMessage(response: Response) {
  return mobileErrorResponseSchema.parse(await response.json()).message;
}

describe("POST /api/mobile/v1/rider/parcels/{parcelId}/return", async () => {
  const { POST } = await import("@/app/api/mobile/v1/rider/parcels/[parcelId]/return/route");

  function returnParcel(id = parcelId) {
    return POST(
      new Request(`http://localhost:3000/api/mobile/v1/rider/parcels/${id}/return`, {
        method: "POST",
      }),
      { params: Promise.resolve({ parcelId: id }) },
    );
  }

  beforeEach(() => {
    session.signOut();
    markRiderParcelReturnedMock.mockReset();
    markRiderParcelReturnedMock.mockResolvedValue(undefined);
    revalidateTagMock.mockReset();
  });

  test("returns 401 without a session", async () => {
    const response = await returnParcel();

    expect(response.status).toBe(401);
    expect(markRiderParcelReturnedMock).not.toHaveBeenCalled();
  });

  test("returns 403 for inactive and non-rider users", async () => {
    session.signInAs("rider", false);
    expect((await returnParcel()).status).toBe(403);

    session.signInAs("merchant");
    expect((await returnParcel()).status).toBe(403);
    expect(markRiderParcelReturnedMock).not.toHaveBeenCalled();
  });

  test("returns 400 for a parcel id that isn't a UUID", async () => {
    session.signInAs("rider");

    const response = await returnParcel("nope");

    expect(response.status).toBe(400);
    expect(await errorMessage(response)).toBe("Invalid parcel selection.");
  });

  test("returns the parcel and expires caches immediately", async () => {
    session.signInAs("rider");

    const response = await returnParcel();
    const body = mobileReturnToMerchantResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.message).toBe("Parcel returned to merchant.");
    expect(body.data).toEqual({ parcelId });
    expect(markRiderParcelReturnedMock).toHaveBeenCalledWith(
      expect.objectContaining({ parcelId, riderUserId: riderId }),
    );
    expect(revalidateTagMock).toHaveBeenCalledWith(`rider-parcels:${riderId}`, { expire: 0 });
  });

  test("returns 404 with one message for a missing or another rider's parcel", async () => {
    session.signInAs("rider");

    for (const code of ["not_found", "not_assigned"] as const) {
      markRiderParcelReturnedMock.mockRejectedValueOnce(
        new ParcelOperationError(code, "Internal wording."),
      );

      const response = await returnParcel();

      expect(response.status).toBe(404);
      expect(await errorMessage(response)).toBe("Parcel not found.");
    }
  });

  test("returns 409 for a parcel that isn't awaiting return", async () => {
    session.signInAs("rider");
    markRiderParcelReturnedMock.mockRejectedValue(
      new ParcelOperationError(
        "conflict",
        "Only canceled-returned parcels can be completed as returned.",
      ),
    );

    const response = await returnParcel();

    expect(response.status).toBe(409);
    expect(await errorMessage(response)).toBe(
      "Only canceled-returned parcels can be completed as returned.",
    );
  });

  test("returns 500 without internal details", async () => {
    session.signInAs("rider");
    markRiderParcelReturnedMock.mockRejectedValue(new Error("connection reset by 10.0.0.4"));

    const response = await returnParcel();

    expect(response.status).toBe(500);
    expect(await errorMessage(response)).toBe("Unable to complete parcel return.");
  });
});
