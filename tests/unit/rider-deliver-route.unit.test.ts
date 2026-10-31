import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { ParcelListItemDto } from "@/features/parcels/server/dto";
import { buildParcelListItem, buildSessionUser } from "../fixtures/builders";

const getSessionMock = mock(async (): Promise<unknown> => null);
const headersMock = mock(async () => new Headers());
const markRiderParcelDeliveredMock = mock(async (): Promise<void> => undefined);
const getParcelByIdForRealtimeScopeMock = mock(async (): Promise<ParcelListItemDto | null> => null);
const uploadDeliveryProofImageMock = mock(async (): Promise<string> => "parcels/p/proof.jpg");

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
const actualParcelsDal = await import("@/features/parcels/server/dal");
const actualUpload = await import("@/features/parcels/server/upload");

void mock.module("@/features/parcels/server/dal", () => ({
  ...actualParcelsDal,
  markRiderParcelDelivered: markRiderParcelDeliveredMock,
  getParcelByIdForRealtimeScope: getParcelByIdForRealtimeScopeMock,
}));

void mock.module("@/features/parcels/server/upload", () => ({
  ...actualUpload,
  uploadDeliveryProofImage: uploadDeliveryProofImageMock,
}));

const parcelId = "0f7a3c2e-2222-4b1c-8d9e-000000000002";

function deliverRequest(fields: Record<string, string | File> | null) {
  const body = new FormData();

  for (const [key, value] of Object.entries(fields ?? {})) {
    body.set(key, value);
  }

  return new Request("http://localhost:3000/api/rider/parcels/deliver", {
    method: "POST",
    ...(fields ? { body } : { body: "not multipart", headers: { "Content-Type": "text/plain" } }),
  });
}

const photo = () => new File([new Uint8Array(512)], "proof.jpg", { type: "image/jpeg" });

describe("POST /api/rider/parcels/deliver (web)", async () => {
  const { POST } = await import("@/app/api/rider/parcels/deliver/route");

  beforeEach(() => {
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue(buildSessionUser({ role: "rider" }));
    markRiderParcelDeliveredMock.mockReset();
    markRiderParcelDeliveredMock.mockResolvedValue(undefined);
    getParcelByIdForRealtimeScopeMock.mockReset();
    getParcelByIdForRealtimeScopeMock.mockResolvedValue(
      buildParcelListItem({ id: parcelId, status: "on_the_way" }),
    );
    uploadDeliveryProofImageMock.mockReset();
    uploadDeliveryProofImageMock.mockResolvedValue("parcels/p/proof.jpg");
  });

  test("returns 401 without a session", async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await POST(deliverRequest({ parcelId, proofImage: photo() }));

    expect(response.status).toBe(401);
  });

  test("returns 403 for non-riders", async () => {
    getSessionMock.mockResolvedValue(buildSessionUser({ role: "office_admin" }));

    const response = await POST(deliverRequest({ parcelId, proofImage: photo() }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      ok: false,
      message: "You do not have permission to mark parcels delivered.",
    });
  });

  test("returns 400 for a body that isn't multipart or has no photo", async () => {
    expect((await POST(deliverRequest(null))).status).toBe(400);

    const response = await POST(deliverRequest({ parcelId }));

    expect(response.status).toBe(400);
    expect((await response.json()).message).toBe("Delivery proof photo is required.");
  });

  test("returns rule failures as 500 with the message, as before", async () => {
    getParcelByIdForRealtimeScopeMock.mockResolvedValue(
      buildParcelListItem({ id: parcelId, status: "delivered" }),
    );

    const response = await POST(deliverRequest({ parcelId, proofImage: photo() }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false,
      message: "Only on-the-way parcels can be marked delivered.",
    });
  });

  test("marks the parcel delivered", async () => {
    const response = await POST(deliverRequest({ parcelId, proofImage: photo() }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, message: "Parcel marked delivered." });
  });
});
