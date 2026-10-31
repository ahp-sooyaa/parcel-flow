import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  mobileErrorResponseSchema,
  mobileMarkDeliveredResponseSchema,
} from "@/features/mobile-api/contract";
import type { ParcelListItemDto } from "@/features/parcels/server/dto";
import { ParcelOperationError } from "@/features/parcels/server/errors";
import { buildParcelListItem, buildSessionUser } from "../fixtures/builders";

const getSessionMock = mock(async (): Promise<unknown> => null);
const headersMock = mock(async () => new Headers());
const markRiderParcelDeliveredMock = mock(async (): Promise<void> => undefined);
const getParcelByIdForRealtimeScopeMock = mock(async (): Promise<ParcelListItemDto | null> => null);
const uploadDeliveryProofImageMock = mock(async (): Promise<string> => "parcels/p/proof.jpg");
const deleteDeliveryProofImageMock = mock(async (): Promise<void> => undefined);
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
const actualUpload = await import("@/features/parcels/server/upload");

void mock.module("next/cache", () => ({
  ...actualNextCache,
  revalidateTag: revalidateTagMock,
}));

void mock.module("@/features/parcels/server/dal", () => ({
  ...actualParcelsDal,
  markRiderParcelDelivered: markRiderParcelDeliveredMock,
  getParcelByIdForRealtimeScope: getParcelByIdForRealtimeScopeMock,
}));

void mock.module("@/features/parcels/server/upload", () => ({
  ...actualUpload,
  uploadDeliveryProofImage: uploadDeliveryProofImageMock,
  deleteDeliveryProofImage: deleteDeliveryProofImageMock,
}));

const riderId = "8b3c5d4e-1111-4a2b-9c3d-000000000001";
const parcelId = "0f7a3c2e-2222-4b1c-8d9e-000000000002";

function signInAs(role: "rider" | "merchant", isActive = true) {
  getSessionMock.mockResolvedValue(buildSessionUser({ id: riderId, role, isActive }));
}

function deliverRequest(proofImage: File | null, multipart = true) {
  const body = new FormData();

  if (proofImage) {
    body.set("proofImage", proofImage);
  }

  return new Request(`http://localhost:3000/api/mobile/v1/rider/parcels/${parcelId}/deliver`, {
    method: "POST",
    ...(multipart ? { body } : { body: "{}", headers: { "Content-Type": "application/json" } }),
  });
}

function context(id = parcelId) {
  return { params: Promise.resolve({ parcelId: id }) };
}

// Bun's multipart parser infers the type from the file name, so keep them in step.
const photo = (type = "image/jpeg") =>
  new File([new Uint8Array(512)], `proof.${type.split("/")[1]}`, { type });

async function errorMessage(response: Response) {
  return mobileErrorResponseSchema.parse(await response.json()).message;
}

describe("POST /api/mobile/v1/rider/parcels/[parcelId]/deliver", async () => {
  const { POST } = await import("@/app/api/mobile/v1/rider/parcels/[parcelId]/deliver/route");

  beforeEach(() => {
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue(null);
    markRiderParcelDeliveredMock.mockReset();
    markRiderParcelDeliveredMock.mockResolvedValue(undefined);
    getParcelByIdForRealtimeScopeMock.mockReset();
    getParcelByIdForRealtimeScopeMock.mockResolvedValue(
      buildParcelListItem({ id: parcelId, status: "on_the_way" }),
    );
    uploadDeliveryProofImageMock.mockReset();
    uploadDeliveryProofImageMock.mockResolvedValue("parcels/p/proof.jpg");
    deleteDeliveryProofImageMock.mockReset();
    deleteDeliveryProofImageMock.mockResolvedValue(undefined);
    revalidateTagMock.mockReset();
  });

  test("returns 401 without a session and 403 for inactive or non-rider users", async () => {
    expect((await POST(deliverRequest(photo()), context())).status).toBe(401);

    signInAs("rider", false);
    expect((await POST(deliverRequest(photo()), context())).status).toBe(403);

    signInAs("merchant");
    expect((await POST(deliverRequest(photo()), context())).status).toBe(403);
    expect(uploadDeliveryProofImageMock).not.toHaveBeenCalled();
  });

  test.each([
    ["a body that isn't multipart", deliverRequest(photo(), false), parcelId],
    ["a missing photo", deliverRequest(null), parcelId],
    ["a GIF", deliverRequest(photo("image/gif")), parcelId],
    ["a bad parcel id", deliverRequest(photo()), "nope"],
  ])("returns 400 for %s", async (_label, request, id) => {
    signInAs("rider");

    const response = await POST(request, context(id));

    expect(response.status).toBe(400);
    expect(uploadDeliveryProofImageMock).not.toHaveBeenCalled();
  });

  test("delivers the parcel and expires caches immediately", async () => {
    signInAs("rider");

    const response = await POST(deliverRequest(photo()), context());
    const body = mobileMarkDeliveredResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      message: "Parcel marked delivered.",
      data: { parcelId },
    });
    expect(revalidateTagMock).toHaveBeenCalledWith(`rider-parcels:${riderId}`, { expire: 0 });
  });

  test("returns 404 for a parcel that isn't the rider's", async () => {
    signInAs("rider");
    getParcelByIdForRealtimeScopeMock.mockResolvedValue(null);

    const response = await POST(deliverRequest(photo()), context());

    expect(response.status).toBe(404);
    expect(await errorMessage(response)).toBe("Parcel not found.");
  });

  test("returns the same 404 when the DAL finds another rider's parcel", async () => {
    signInAs("rider");
    markRiderParcelDeliveredMock.mockRejectedValue(
      new ParcelOperationError(
        "not_assigned",
        "You can only mark parcels assigned to your rider account delivered.",
      ),
    );

    const response = await POST(deliverRequest(photo()), context());

    expect(response.status).toBe(404);
    expect(await errorMessage(response)).toBe("Parcel not found.");
    expect(deleteDeliveryProofImageMock).toHaveBeenCalledWith("parcels/p/proof.jpg");
  });

  test("returns 409 for a parcel with an active failure note", async () => {
    signInAs("rider");
    getParcelByIdForRealtimeScopeMock.mockResolvedValue(
      buildParcelListItem({
        id: parcelId,
        status: "on_the_way",
        activeFailureNote: { note: "Receiver not home", status: "active" },
      }),
    );

    const response = await POST(deliverRequest(photo()), context());

    expect(response.status).toBe(409);
    expect(await errorMessage(response)).toBe(
      "Resolve the delivery failure note before marking this parcel delivered.",
    );
  });

  test("hides unexpected errors but passes on the photo upload message", async () => {
    signInAs("rider");
    markRiderParcelDeliveredMock.mockRejectedValue(new Error("connection details"));

    const failedSave = await POST(deliverRequest(photo()), context());

    expect(failedSave.status).toBe(500);
    expect(await errorMessage(failedSave)).toBe("Unable to mark parcel delivered.");

    uploadDeliveryProofImageMock.mockRejectedValue(new Error("R2 credentials"));
    const failedUpload = await POST(deliverRequest(photo()), context());

    expect(failedUpload.status).toBe(500);
    expect(await errorMessage(failedUpload)).toBe("Couldn't save the delivery photo. Try again.");
  });
});
