import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import {
  mobileErrorResponseSchema,
  mobileParcelChangedEventSchema,
} from "@/features/mobile-api/contract";
import type {
  ParcelRealtimeRow,
  ParcelRealtimeScopeContext,
  RiderScopeContext,
} from "@/features/parcels/server/realtime";
import { mockSupabaseRealtime, parcelRecord, streamReader } from "../fixtures/fake-realtime";
import { mockMobileRouteSession } from "../fixtures/mobile-route-session";

const riderUserId = "8b3c5d4e-1111-4a2b-9c3d-000000000001";
const session = mockMobileRouteSession(riderUserId);
const realtime = await mockSupabaseRealtime();
const riderScope: RiderScopeContext = { role: "rider", userId: riderUserId, riderId: "rider-1" };
const loadScopeMock = mock(
  async (): Promise<ParcelRealtimeScopeContext> => Promise.resolve(riderScope),
);
// The parcels the rider holds when the stream opens.
const loadRiderParcelIdsMock = mock(async (): Promise<string[]> => Promise.resolve(["held"]));

// Bun keeps module mocks for later test files, so keep the real exports.
const actualRealtime = { ...(await import("@/features/parcels/server/realtime")) };

void mock.module("@/features/parcels/server/realtime", () => ({
  ...actualRealtime,
  loadParcelRealtimeScopeContext: loadScopeMock,
  loadRiderParcelIds: loadRiderParcelIdsMock,
}));

describe("GET /api/mobile/v1/rider/parcels/events", async () => {
  const { GET } = await import("@/app/api/mobile/v1/rider/parcels/events/route");
  const openAborts: AbortController[] = [];

  function openStream() {
    const abort = new AbortController();
    openAborts.push(abort);
    return GET(
      new Request("http://localhost:3000/api/mobile/v1/rider/parcels/events", {
        signal: abort.signal,
      }),
    );
  }

  beforeEach(() => {
    session.signOut();
    realtime.reset();
    loadScopeMock.mockClear();
    loadScopeMock.mockResolvedValue(riderScope);
    loadRiderParcelIdsMock.mockClear();
  });

  afterEach(() => {
    for (const abort of openAborts.splice(0)) {
      abort.abort();
    }
  });

  test("returns 401 JSON without a session", async () => {
    const response = await openStream();

    expect(response.status).toBe(401);
    expect(mobileErrorResponseSchema.parse(await response.json()).ok).toBe(false);
    expect(realtime.channels).toHaveLength(0);
  });

  test("returns 403 JSON for inactive and non-rider users", async () => {
    session.signInAs("rider", false);
    expect((await openStream()).status).toBe(403);

    session.signInAs("merchant");
    expect((await openStream()).status).toBe(403);
    expect(realtime.channels).toHaveLength(0);
  });

  test("returns 500 JSON when the rider's scope can't be loaded", async () => {
    session.signInAs("rider");
    loadScopeMock.mockRejectedValue(new Error("Rider profile was not found."));

    const response = await openStream();

    expect(response.status).toBe(500);
    expect(mobileErrorResponseSchema.parse(await response.json()).message).toBe(
      "Unable to open live parcel updates.",
    );
  });

  test("streams ready, then the ids of the rider's changed parcels only", async () => {
    session.signInAs("rider");
    const response = await openStream();
    const reader = streamReader(response);
    const channel = realtime.channels[0];

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    channel?.setStatus("SUBSCRIBED");
    expect(await reader.next()).toBe("event: ready\ndata: {}\n\n");

    channel?.emitChange({ new: parcelRecord({ id: "other", rider_id: "rider-2" }) });
    channel?.emitChange({ new: parcelRecord({ id: "mine" }) });

    const frame = await reader.next();
    expect(frame).toBe('event: parcel-changed\ndata: {"parcelId":"mine"}\n\n');
    const data = frame?.split("data: ")[1]?.trim() ?? "";
    expect(mobileParcelChangedEventSchema.parse(JSON.parse(data))).toEqual({ parcelId: "mine" });
  });

  test("tells the rider when a parcel they hold is reassigned, from the key-only old row", async () => {
    session.signInAs("rider");
    const reader = streamReader(await openStream());
    const channel = realtime.channels[0];

    expect(loadRiderParcelIdsMock).toHaveBeenCalledWith("rider-1");

    // Postgres sends only the primary key as an update's old row.
    channel?.emitChange({ new: parcelRecord({ id: "held", rider_id: null }), old: { id: "held" } });

    expect(await reader.next()).toBe('event: parcel-changed\ndata: {"parcelId":"held"}\n\n');
  });

  test("limits each rider to two open streams", async () => {
    session.signInAs("rider");
    expect((await openStream()).status).toBe(200);
    expect((await openStream()).status).toBe(200);
    expect((await openStream()).status).toBe(204);
  });
});

// Old rows carry only the key, so changes have no previousRow, as in production.
function change(nextRow: ParcelRealtimeRow | null) {
  return { parcelId: "p1", nextRow, previousRow: null };
}

describe("createRiderParcelChangeTracker", () => {
  const { createRiderParcelChangeTracker } = actualRealtime;
  const mine = parcelRecord({ id: "p1", rider_id: "rider-1" });
  const theirs = parcelRecord({ id: "p1", rider_id: "rider-2" });
  const changed = { type: "parcel-changed", payload: { parcelId: "p1" } } as const;

  test("sends an event when a parcel becomes the rider's, then while it stays theirs", () => {
    const track = createRiderParcelChangeTracker(riderScope, []);

    expect(track(change(mine))).toEqual(changed);
    expect(track(change(mine))).toEqual(changed);
  });

  test.each([
    ["reassigned to another rider", theirs],
    ["unassigned", { ...mine, rider_id: null }],
    ["soft-deleted", { ...mine, deleted_at: "2026-11-01T00:00:00.000Z" }],
    ["hard-deleted", null],
  ])("sends an event when a parcel the rider held is %s, then forgets it", (_label, nextRow) => {
    const track = createRiderParcelChangeTracker(riderScope, ["p1"]);

    expect(track(change(nextRow))).toEqual(changed);
    expect(track(change(nextRow))).toBeNull();
  });

  test("learns parcels assigned after the stream opened", () => {
    const track = createRiderParcelChangeTracker(riderScope, []);

    track(change(mine));

    expect(track(change(theirs))).toEqual(changed);
  });

  test("skips another rider's parcel, and changes without an id", () => {
    const track = createRiderParcelChangeTracker(riderScope, []);

    expect(track(change(theirs))).toBeNull();
    expect(track({ parcelId: null, nextRow: null, previousRow: null })).toBeNull();
  });
});
