import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

import type { ParcelRowChange } from "@/features/parcels/server/realtime-stream";
import {
  flushPromises,
  mockSupabaseRealtime,
  parcelRecord,
  streamReader,
} from "../fixtures/fake-realtime";

const realtime = await mockSupabaseRealtime();

describe("openParcelChangeStream", async () => {
  const { openParcelChangeStream } = await import("@/features/parcels/server/realtime-stream");
  const toEventMock = mock(async (_change: ParcelRowChange) =>
    Promise.resolve<{ type: string; payload: unknown } | null>({
      type: "parcel-changed",
      payload: { parcelId: "p1" },
    }),
  );
  const openAborts: AbortController[] = [];

  function open(key = "client-1", max = 2) {
    const abort = new AbortController();
    openAborts.push(abort);
    const response = openParcelChangeStream({
      request: new Request("http://localhost/stream", { signal: abort.signal }),
      channelName: `test-${openAborts.length}`,
      limit: { key, max },
      readyPayload: { surface: "rider-list" },
      toEvent: toEventMock,
    });
    return { response, abort };
  }

  beforeEach(() => {
    realtime.reset();
    toEventMock.mockClear();
  });

  afterEach(() => {
    // Free every slot so one test's streams don't count against the next.
    for (const abort of openAborts.splice(0)) {
      abort.abort();
    }
  });

  test("sends ready once subscribed, then the events toEvent returns", async () => {
    const { response } = open();
    const reader = streamReader(response);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    realtime.channels[0]?.setStatus("SUBSCRIBED");
    expect(await reader.next()).toBe('event: ready\ndata: {"surface":"rider-list"}\n\n');

    realtime.channels[0]?.emitChange({ new: parcelRecord({ id: "p1" }) });
    expect(await reader.next()).toBe('event: parcel-changed\ndata: {"parcelId":"p1"}\n\n');
    expect(toEventMock.mock.calls[0]?.[0]).toEqual({
      parcelId: "p1",
      nextRow: expect.objectContaining({ id: "p1", rider_id: "rider-1" }),
      previousRow: null,
    });
  });

  test("takes the id from the old row of a delete, which carries only the key", async () => {
    const { response } = open();
    const reader = streamReader(response);

    realtime.channels[0]?.emitChange({ new: {}, old: { id: "gone" } });
    await reader.next();

    expect(toEventMock.mock.calls[0]?.[0]).toEqual({
      parcelId: "gone",
      nextRow: null,
      previousRow: null,
    });
  });

  test("skips changes toEvent turns into null", async () => {
    toEventMock.mockResolvedValueOnce(null);
    const { response } = open();
    const reader = streamReader(response);

    realtime.channels[0]?.emitChange({ new: parcelRecord() });
    await flushPromises();
    realtime.channels[0]?.setStatus("SUBSCRIBED");

    // The skipped change wrote nothing, so the next frame is `ready`.
    expect(await reader.next()).toContain("event: ready");
  });

  test("reports a failing toEvent and a channel error as stream-error", async () => {
    toEventMock.mockRejectedValueOnce(new Error("lookup failed"));
    const { response } = open();
    const reader = streamReader(response);

    realtime.channels[0]?.emitChange({ new: parcelRecord() });
    expect(await reader.next()).toBe('event: stream-error\ndata: {"message":"lookup failed"}\n\n');

    realtime.channels[0]?.setStatus("CHANNEL_ERROR", new Error("socket down"));
    expect(await reader.next()).toContain('"message":"socket down"');
  });

  test("writes a keepalive comment on its interval", async () => {
    const setIntervalSpy = spyOn(globalThis, "setInterval");
    const { response } = open();
    const reader = streamReader(response);
    const keepalive = setIntervalSpy.mock.calls.at(-1)?.[0];
    setIntervalSpy.mockRestore();

    if (typeof keepalive !== "function") {
      throw new Error("The stream didn't start a keepalive interval.");
    }
    keepalive();

    expect(await reader.next()).toBe(": keepalive\n\n");
  });

  test("cleans up once on abort and frees the slot", async () => {
    const first = open("client-1", 1);
    expect(open("client-1", 1).response.status).toBe(204);

    first.abort.abort();
    first.abort.abort();

    expect(await streamReader(first.response).next()).toBeNull();
    expect(realtime.removeChannel).toHaveBeenCalledTimes(1);
    expect(open("client-1", 1).response.status).toBe(200);
  });

  test("closes when the channel closes", async () => {
    const { response } = open();

    realtime.channels[0]?.setStatus("CLOSED");

    expect(await streamReader(response).next()).toBeNull();
    expect(realtime.removeChannel).toHaveBeenCalledTimes(1);
  });

  test("returns 204 past the per-client cap, while other clients still connect", () => {
    expect(open("client-1").response.status).toBe(200);
    expect(open("client-1").response.status).toBe(200);
    expect(open("client-1").response.status).toBe(204);
    expect(open("client-2").response.status).toBe(200);
  });

  test("returns 204 once the shared budget of 80 streams is used", () => {
    for (let index = 0; index < 80; index += 1) {
      expect(open(`client-${index}`, 1).response.status).toBe(200);
    }

    expect(open("one-more", 1).response.status).toBe(204);
  });
});
