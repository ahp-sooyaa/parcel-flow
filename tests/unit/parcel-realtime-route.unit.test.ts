import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type {
  ParcelRealtimeScopeContext,
  ParcelRealtimeStreamEvent,
} from "@/features/parcels/server/realtime";
import { mockSupabaseRealtime, parcelRecord, streamReader } from "../fixtures/fake-realtime";
import { mockMobileRouteSession } from "../fixtures/mobile-route-session";

const userId = "8b3c5d4e-1111-4a2b-9c3d-000000000009";
const session = mockMobileRouteSession(userId);
const realtime = await mockSupabaseRealtime();
const buildEventMock = mock(
  async (_input: {
    surface: string;
    nextRow: unknown;
    previousRow: unknown;
  }): Promise<ParcelRealtimeStreamEvent | null> =>
    Promise.resolve({ type: "parcel-remove", parcelId: "p1" }),
);

// Bun keeps module mocks for later test files, so keep the real exports.
const actualRealtime = { ...(await import("@/features/parcels/server/realtime")) };

void mock.module("@/features/parcels/server/realtime", () => ({
  ...actualRealtime,
  loadParcelRealtimeScopeContext: (): Promise<ParcelRealtimeScopeContext> =>
    Promise.resolve({ role: "office_admin", userId }),
  buildParcelRealtimeEventForScope: buildEventMock,
}));

describe("GET /api/realtime/parcels", async () => {
  const { GET } = await import("@/app/api/realtime/parcels/route");
  const openAborts: AbortController[] = [];

  function openStream(surface: string) {
    const abort = new AbortController();
    openAborts.push(abort);
    return GET(
      new Request(`http://localhost:3000/api/realtime/parcels?surface=${surface}`, {
        signal: abort.signal,
        headers: { "x-forwarded-for": "203.0.113.7" },
      }),
    );
  }

  beforeEach(() => {
    session.signInAs("office_admin");
    realtime.reset();
    buildEventMock.mockClear();
  });

  afterEach(() => {
    for (const abort of openAborts.splice(0)) {
      abort.abort();
    }
  });

  test("returns 400 for an unknown surface", async () => {
    const response = await openStream("nope");

    expect(response.status).toBe(400);
    expect(realtime.channels).toHaveLength(0);
  });

  test("keeps its ready payload and sends whole events as data", async () => {
    const response = await openStream("admin-list");
    const reader = streamReader(response);

    realtime.channels[0]?.setStatus("SUBSCRIBED");
    expect(await reader.next()).toBe('event: ready\ndata: {"surface":"admin-list"}\n\n');

    realtime.channels[0]?.emitChange({ old: parcelRecord({ id: "p1" }) });
    expect(await reader.next()).toBe(
      'event: parcel-remove\ndata: {"type":"parcel-remove","parcelId":"p1"}\n\n',
    );
    expect(buildEventMock.mock.calls[0]?.[0]).toMatchObject({
      surface: "admin-list",
      nextRow: null,
      previousRow: expect.objectContaining({ id: "p1" }),
    });
  });

  test("still limits one client IP to four streams", async () => {
    for (let index = 0; index < 4; index += 1) {
      expect((await openStream("admin-list")).status).toBe(200);
    }

    expect((await openStream("admin-list")).status).toBe(204);
  });
});
