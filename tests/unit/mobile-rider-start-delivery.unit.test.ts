import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  mobileErrorResponseSchema,
  mobileStartDeliveryRequestSchema,
  mobileStartDeliveryResponseSchema,
} from "@/features/mobile-api/contract";
import { ParcelOperationError } from "@/features/parcels/server/errors";
import { startDeliveryInputSchema } from "@/features/parcels/server/rider-operations";
import { buildSessionUser } from "../fixtures/builders";

const getSessionMock = mock(async (): Promise<unknown> => null);
const headersMock = mock(async () => new Headers());
const startDeliveryForRiderParcelsMock = mock(async (): Promise<void> => undefined);
const revalidateTagMock = mock(() => undefined);

void mock.module("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

void mock.module("next/headers", () => ({
  headers: headersMock,
}));

// Bun keeps module mocks for later test files, so keep the real exports.
const actualNextCache = await import("next/cache");
const actualParcelsDal = await import("@/features/parcels/server/dal");

void mock.module("next/cache", () => ({
  ...actualNextCache,
  revalidateTag: revalidateTagMock,
}));

void mock.module("@/features/parcels/server/dal", () => ({
  ...actualParcelsDal,
  startDeliveryForRiderParcels: startDeliveryForRiderParcelsMock,
}));

const riderId = "8b3c5d4e-1111-4a2b-9c3d-000000000001";
const parcelA = "0f7a3c2e-2222-4b1c-8d9e-000000000002";
const parcelB = "0f7a3c2e-2222-4b1c-8d9e-000000000003";

function signInAs(role: "rider" | "merchant" | "office_admin", isActive = true) {
  getSessionMock.mockResolvedValue(buildSessionUser({ id: riderId, role, isActive }));
}

function startRequest(body: unknown) {
  return new Request("http://localhost:3000/api/mobile/v1/rider/parcels/start-delivery", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function errorMessage(response: Response) {
  return mobileErrorResponseSchema.parse(await response.json()).message;
}

describe("POST /api/mobile/v1/rider/parcels/start-delivery", async () => {
  const { POST } = await import("@/app/api/mobile/v1/rider/parcels/start-delivery/route");

  beforeEach(() => {
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue(null);
    startDeliveryForRiderParcelsMock.mockReset();
    startDeliveryForRiderParcelsMock.mockResolvedValue(undefined);
    revalidateTagMock.mockReset();
  });

  test("returns 401 without a session", async () => {
    const response = await POST(startRequest({ parcelIds: [parcelA] }));

    expect(response.status).toBe(401);
    expect(startDeliveryForRiderParcelsMock).not.toHaveBeenCalled();
  });

  test("returns 403 for inactive and non-rider users", async () => {
    signInAs("rider", false);
    expect((await POST(startRequest({ parcelIds: [parcelA] }))).status).toBe(403);

    signInAs("merchant");
    expect((await POST(startRequest({ parcelIds: [parcelA] }))).status).toBe(403);
    expect(startDeliveryForRiderParcelsMock).not.toHaveBeenCalled();
  });

  test("returns 400 for a body that isn't JSON", async () => {
    signInAs("rider");

    const response = await POST(startRequest("parcelIds=1"));

    expect(response.status).toBe(400);
    expect(await errorMessage(response)).toBe("A valid JSON body is required.");
  });

  test.each([{}, { parcelIds: [] }, { parcelIds: ["nope"] }])(
    "returns 400 for an invalid body %#",
    async (body) => {
      signInAs("rider");

      const response = await POST(startRequest(body));

      expect(response.status).toBe(400);
      expect(startDeliveryForRiderParcelsMock).not.toHaveBeenCalled();
    },
  );

  test("starts the rider's parcels and expires caches immediately", async () => {
    signInAs("rider");

    const response = await POST(startRequest({ parcelIds: [parcelA, parcelB] }));
    const body = mobileStartDeliveryResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.message).toBe("Selected parcels moved to on the way.");
    expect(body.data.parcelIds).toEqual([parcelA, parcelB]);
    expect(startDeliveryForRiderParcelsMock).toHaveBeenCalledWith({
      parcelIds: [parcelA, parcelB],
      riderUserId: riderId,
      actorRole: "rider",
    });
    expect(revalidateTagMock).toHaveBeenCalledWith(`rider-parcels:${riderId}`, { expire: 0 });
  });

  test.each([
    ["not_found", "One or more selected parcels were not found."],
    ["not_assigned", "You can only start delivery for parcels assigned to your rider account."],
  ] as const)("returns the same 404 for %s", async (code, dalMessage) => {
    signInAs("rider");
    startDeliveryForRiderParcelsMock.mockRejectedValue(new ParcelOperationError(code, dalMessage));

    const response = await POST(startRequest({ parcelIds: [parcelA] }));

    expect(response.status).toBe(404);
    expect(await errorMessage(response)).toBe("One or more selected parcels were not found.");
  });

  test("returns 409 when a parcel is no longer at the office", async () => {
    signInAs("rider");
    startDeliveryForRiderParcelsMock.mockRejectedValue(
      new ParcelOperationError(
        "conflict",
        "Only assigned at-office parcels can be started for delivery.",
      ),
    );

    const response = await POST(startRequest({ parcelIds: [parcelA] }));

    expect(response.status).toBe(409);
    expect(await errorMessage(response)).toBe(
      "Only assigned at-office parcels can be started for delivery.",
    );
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  test("returns 403 when the DAL finds no active rider profile", async () => {
    signInAs("rider");
    startDeliveryForRiderParcelsMock.mockRejectedValue(
      new ParcelOperationError("forbidden", "Active rider profile was not found."),
    );

    const response = await POST(startRequest({ parcelIds: [parcelA] }));

    expect(response.status).toBe(403);
  });

  test("returns a generic 500 for unexpected errors", async () => {
    signInAs("rider");
    startDeliveryForRiderParcelsMock.mockRejectedValue(new Error("connection details"));

    const response = await POST(startRequest({ parcelIds: [parcelA] }));

    expect(response.status).toBe(500);
    expect(await errorMessage(response)).toBe("Unable to start delivery.");
  });

  test("the contract and server request schemas accept and reject the same bodies", () => {
    const tooMany = Array.from(
      { length: 51 },
      (_, index) => `0f7a3c2e-2222-4b1c-8d9e-${String(index).padStart(12, "0")}`,
    );
    const fixtures: unknown[] = [
      { parcelIds: [parcelA] },
      { parcelIds: [parcelA, parcelB, parcelA] },
      { parcelIds: tooMany.slice(0, 50) },
      { parcelIds: tooMany },
      { parcelIds: [] },
      { parcelIds: ["nope"] },
      { parcelIds: [42] },
      {},
      null,
    ];

    for (const fixture of fixtures) {
      expect(mobileStartDeliveryRequestSchema.safeParse(fixture).success).toBe(
        startDeliveryInputSchema.safeParse(fixture).success,
      );
    }
  });
});
