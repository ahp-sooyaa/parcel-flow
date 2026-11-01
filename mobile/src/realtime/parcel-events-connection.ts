import {
  MOBILE_API_BASE_PATH,
  MOBILE_RIDER_PARCEL_EVENTS_PATH,
  mobileParcelChangedEventSchema,
} from "@parcel-flow/contract";

import { authClient } from "@/auth/client";
import { apiUrl } from "@/config";
import { createSseParser, type SseEvent } from "@/realtime/sse-parser";

export const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];
// The server writes a keepalive every 20 seconds; this long without a byte
// means the connection died without closing, as mobile networks can.
export const SILENCE_TIMEOUT_MS = 50_000;
// 204 means the server is at its stream limit; the app keeps refetching on
// focus in the meantime.
export const CAPACITY_RETRY_MS = 60_000;
// Changes in this window share one refetch, e.g. a batch start delivery.
export const BATCH_WINDOW_MS = 1_000;

export type ParcelEventsHandlers = {
  /** These parcels changed (batched): refetch the lists and their details. */
  onChanged: (parcelIds: string[]) => void;
  /** The stream is back after a drop: refetch what may have been missed. */
  onReconnected: () => void;
  /** The session is gone (401). */
  onUnauthorized: () => void;
};

type Timer = ReturnType<typeof setTimeout>;

/**
 * The rider's live parcel stream, kept open between `start()` and `stop()`:
 * it reconnects with backoff after drops and restarts a silent stream.
 */
export function createParcelEventsConnection(handlers: ParcelEventsHandlers) {
  // Bumped by stop(), so a stream from an earlier start() can't schedule more work.
  let generation = 0;
  let running = false;
  let attempt = 0;
  let dropped = false;
  let abort: AbortController | null = null;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let retryTimer: Timer | null = null;
  let watchdogTimer: Timer | null = null;
  let batchTimer: Timer | null = null;
  const pending = new Set<string>();

  function clear(timer: Timer | null) {
    if (timer) {
      clearTimeout(timer);
    }
    return null;
  }

  function closeStream() {
    watchdogTimer = clear(watchdogTimer);
    // The Expo docs don't say fetch honours abort, so cancel the body too.
    void reader?.cancel().catch(() => undefined);
    abort?.abort();
    reader = null;
    abort = null;
  }

  function scheduleRetry(gen: number, delayMs?: number) {
    closeStream();

    if (gen !== generation) {
      return;
    }

    dropped = true;
    const base = RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)] ?? 30_000;
    // ±20% so phones don't all reconnect at once after a server restart.
    const delay = delayMs ?? base * (0.8 + Math.random() * 0.4);
    attempt += 1;
    retryTimer = setTimeout(() => void connect(gen), delay);
  }

  function armWatchdog() {
    watchdogTimer = clear(watchdogTimer);
    watchdogTimer = setTimeout(closeStream, SILENCE_TIMEOUT_MS);
  }

  function flushChanges() {
    batchTimer = null;
    const parcelIds = [...pending];
    pending.clear();

    if (parcelIds.length > 0) {
      handlers.onChanged(parcelIds);
    }
  }

  function handleEvent({ event, data }: SseEvent) {
    if (event === "ready") {
      attempt = 0;

      if (dropped) {
        dropped = false;
        handlers.onReconnected();
      }
    } else if (event === "parcel-changed") {
      const parsed = mobileParcelChangedEventSchema.safeParse(safeJson(data));

      if (parsed.success) {
        pending.add(parsed.data.parcelId);
        batchTimer ??= setTimeout(flushChanges, BATCH_WINDOW_MS);
      }
    } else if (event === "stream-error") {
      // Ending the read loop reconnects.
      closeStream();
    }
  }

  async function readBody(body: ReadableStream<Uint8Array>) {
    reader = body.getReader();
    const decoder = new TextDecoder();
    const parser = createSseParser(handleEvent);
    armWatchdog();

    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        return;
      }

      armWatchdog();
      parser.push(decoder.decode(value, { stream: true }));
    }
  }

  async function connect(gen: number) {
    retryTimer = null;

    if (gen !== generation) {
      return;
    }

    abort = new AbortController();
    let response: Response;

    try {
      response = await fetch(`${apiUrl}${MOBILE_API_BASE_PATH}${MOBILE_RIDER_PARCEL_EVENTS_PATH}`, {
        headers: { Accept: "text/event-stream", Cookie: authClient.getCookie() },
        // The session travels in the Cookie header above, not the platform cookie jar.
        credentials: "omit",
        signal: abort.signal,
      });
    } catch {
      scheduleRetry(gen);
      return;
    }

    if (gen !== generation) {
      void response.body?.cancel().catch(() => undefined);
      return;
    }

    if (response.status === 401) {
      stop();
      handlers.onUnauthorized();
      return;
    }

    if (response.status === 403) {
      stop();
      return;
    }

    if (response.status === 204) {
      scheduleRetry(gen, CAPACITY_RETRY_MS);
      return;
    }

    if (response.ok && response.body) {
      await readBody(response.body).catch(() => undefined);
    }

    scheduleRetry(gen);
  }

  function start() {
    if (running) {
      return;
    }

    running = true;
    attempt = 0;
    dropped = false;
    void connect(generation);
  }

  function stop() {
    running = false;
    generation += 1;
    retryTimer = clear(retryTimer);
    batchTimer = clear(batchTimer);
    pending.clear();
    closeStream();
  }

  return { start, stop };
}

function safeJson(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}
