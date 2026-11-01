import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  MOBILE_FAILURE_NOTE_MAX_LENGTH,
  mobileErrorResponseSchema,
  mobileFailureNoteResponseSchema,
} from "@/features/mobile-api/contract";
import { ParcelOperationError } from "@/features/parcels/server/errors";
import { TEXT_LIMITS } from "@/lib/validation";
import { mockMobileRouteSession } from "../fixtures/mobile-route-session";

const riderId = "8b3c5d4e-1111-4a2b-9c3d-000000000001";
const session = mockMobileRouteSession(riderId);
const reportDeliveryFailureMock = mock(async (): Promise<void> => undefined);
const updateDeliveryFailureMock = mock(async (): Promise<void> => undefined);
const deleteDeliveryFailureMock = mock(async (): Promise<void> => undefined);
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
  reportDeliveryFailureForRiderParcel: reportDeliveryFailureMock,
  updateDeliveryFailureForRiderParcel: updateDeliveryFailureMock,
  deleteDeliveryFailureForRiderParcel: deleteDeliveryFailureMock,
}));

const parcelId = "0f7a3c2e-2222-4b1c-8d9e-000000000002";
const otherParcelId = "0f7a3c2e-2222-4b1c-8d9e-000000000003";
const routePath = `http://localhost:3000/api/mobile/v1/rider/parcels/${parcelId}/failure-note`;

function noteRequest(method: "POST" | "PATCH" | "DELETE", body?: unknown) {
  return new Request(routePath, {
    method,
    ...(body !== undefined && {
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  });
}

function context(id = parcelId) {
  return { params: Promise.resolve({ parcelId: id }) };
}

async function errorMessage(response: Response) {
  return mobileErrorResponseSchema.parse(await response.json()).message;
}

describe("/api/mobile/v1/rider/parcels/{parcelId}/failure-note", async () => {
  const route = await import("@/app/api/mobile/v1/rider/parcels/[parcelId]/failure-note/route");

  const verbs = [
    {
      method: "POST",
      handler: route.POST,
      dal: reportDeliveryFailureMock,
      body: { note: "  Receiver didn't answer.  " },
      message: "Delivery failure reported.",
      activeFailureNote: "Receiver didn't answer.",
    },
    {
      method: "PATCH",
      handler: route.PATCH,
      dal: updateDeliveryFailureMock,
      body: { note: "  Receiver didn't answer.  " },
      message: "Delivery failure note updated.",
      activeFailureNote: "Receiver didn't answer.",
    },
    {
      method: "DELETE",
      handler: route.DELETE,
      dal: deleteDeliveryFailureMock,
      body: undefined,
      message: "Delivery failure note deleted.",
      activeFailureNote: null,
    },
  ] as const;

  beforeEach(() => {
    session.signOut();
    for (const verb of verbs) {
      verb.dal.mockReset();
      verb.dal.mockResolvedValue(undefined);
    }
    revalidateTagMock.mockReset();
  });

  test("the contract's note limit matches the server", () => {
    expect(MOBILE_FAILURE_NOTE_MAX_LENGTH).toBe(TEXT_LIMITS.note);
  });

  describe.each([...verbs])("$method", (verb) => {
    function send(body: unknown = verb.body, id = parcelId) {
      return verb.handler(noteRequest(verb.method, body), context(id));
    }

    test("returns 401 without a session", async () => {
      const response = await send();

      expect(response.status).toBe(401);
      expect(verb.dal).not.toHaveBeenCalled();
    });

    test("returns 403 for inactive and non-rider users", async () => {
      session.signInAs("rider", false);
      expect((await send()).status).toBe(403);

      session.signInAs("merchant");
      expect((await send()).status).toBe(403);
      expect(verb.dal).not.toHaveBeenCalled();
    });

    test("returns 400 for a parcel id that isn't a UUID", async () => {
      session.signInAs("rider");

      const response = await send(verb.body, "nope");

      expect(response.status).toBe(400);
      expect(await errorMessage(response)).toBe("Invalid parcel selection.");
    });

    test("saves, returns the active note, and expires caches immediately", async () => {
      session.signInAs("rider");

      const response = await send();
      const body = mobileFailureNoteResponseSchema.parse(await response.json());

      expect(response.status).toBe(200);
      expect(body.message).toBe(verb.message);
      expect(body.data).toEqual({ parcelId, activeFailureNote: verb.activeFailureNote });
      expect(verb.dal).toHaveBeenCalledWith(
        expect.objectContaining({ parcelId, riderUserId: riderId, actorRole: "rider" }),
      );
      expect(revalidateTagMock).toHaveBeenCalledWith(`rider-parcels:${riderId}`, { expire: 0 });
    });

    test("returns 404 with one message for a missing or another rider's parcel", async () => {
      session.signInAs("rider");

      for (const code of ["not_found", "not_assigned"] as const) {
        verb.dal.mockRejectedValueOnce(new ParcelOperationError(code, "Internal wording."));

        const response = await send();

        expect(response.status).toBe(404);
        expect(await errorMessage(response)).toBe("Parcel not found.");
      }
    });

    test("returns 409 with the rule's message", async () => {
      session.signInAs("rider");
      verb.dal.mockRejectedValue(
        new ParcelOperationError("conflict", "Only on-the-way parcels can be reported as failed."),
      );

      const response = await send();

      expect(response.status).toBe(409);
      expect(await errorMessage(response)).toBe(
        "Only on-the-way parcels can be reported as failed.",
      );
    });

    test("returns 500 without internal details", async () => {
      session.signInAs("rider");
      verb.dal.mockRejectedValue(new Error("connection reset by 10.0.0.4"));

      const response = await send();

      expect(response.status).toBe(500);
      expect(await errorMessage(response)).toBe("Unable to save the failure note.");
    });
  });

  describe.each([verbs[0], verbs[1]])("$method body", (verb) => {
    test("returns 400 for a body that isn't JSON", async () => {
      session.signInAs("rider");

      const response = await verb.handler(noteRequest(verb.method, "note=hi"), context());

      expect(response.status).toBe(400);
      expect(await errorMessage(response)).toBe("A valid JSON body is required.");
    });

    test.each([{}, { note: "   " }, { note: "x".repeat(501) }, null])(
      "returns 400 for an invalid note %#",
      async (body) => {
        session.signInAs("rider");

        const response = await verb.handler(noteRequest(verb.method, body), context());

        expect(response.status).toBe(400);
        expect(verb.dal).not.toHaveBeenCalled();
      },
    );

    test("acts on the path's parcel, not one in the body", async () => {
      session.signInAs("rider");

      await verb.handler(
        noteRequest(verb.method, { note: "Wrong address.", parcelId: otherParcelId }),
        context(),
      );

      expect(verb.dal).toHaveBeenCalledWith(expect.objectContaining({ parcelId }));
    });
  });

  test("DELETE ignores a request body", async () => {
    session.signInAs("rider");

    const response = await route.DELETE(
      noteRequest("DELETE", { parcelId: otherParcelId }),
      context(),
    );

    expect(response.status).toBe(200);
    expect(deleteDeliveryFailureMock).toHaveBeenCalledWith(expect.objectContaining({ parcelId }));
  });
});
