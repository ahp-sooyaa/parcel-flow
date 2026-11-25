// Server-Sent Events plumbing shared by the web parcel stream
// (/api/realtime/parcels) and the mobile rider events stream
// (/api/mobile/v1/rider/parcels/events): connection limits, one Supabase
// realtime channel per stream, the keepalive, and cleanup.
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { REALTIME_SUBSCRIBE_STATES } from "@supabase/realtime-js";

import type { ParcelRealtimeRow } from "@/features/parcels/server/realtime";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const encoder = new TextEncoder();

// All streams share one Supabase socket, and the free plan allows 100 channels
// per socket. Past the cap a page still works; it just stops live-updating.
// The web and mobile streams count against this one budget.
const MAX_OPEN_STREAMS = 80;
const KEEPALIVE_INTERVAL_MS = 20_000;

const openStreamsByKey = new Map<string, number>();
let openStreams = 0;

export type ParcelRowChange = {
  /** The changed parcel's id, from the new row or, for a delete, the old one. */
  parcelId: string | null;
  nextRow: ParcelRealtimeRow | null;
  /**
   * The row before the change. With the table's default replica identity,
   * Postgres sends only the primary key for an update's or delete's old row,
   * so this is usually null; don't rely on it to learn a previous owner.
   */
  previousRow: ParcelRealtimeRow | null;
};

export type ParcelStreamEvent = { type: string; payload: unknown };

function reserveSlot(key: string, max: number) {
  if (openStreams >= MAX_OPEN_STREAMS || (openStreamsByKey.get(key) ?? 0) >= max) {
    return false;
  }

  openStreams += 1;
  openStreamsByKey.set(key, (openStreamsByKey.get(key) ?? 0) + 1);
  return true;
}

function releaseSlot(key: string) {
  openStreams = Math.max(0, openStreams - 1);
  const remaining = (openStreamsByKey.get(key) ?? 1) - 1;

  if (remaining > 0) {
    openStreamsByKey.set(key, remaining);
  } else {
    openStreamsByKey.delete(key);
  }
}

/**
 * Opens a `text/event-stream` of parcel row changes. `toEvent` turns each
 * change into an event, or null to skip it. Over the global cap, or the
 * caller's per-client cap (`limit`), it returns 204 instead, which tells
 * `EventSource` to stop reconnecting.
 */
export function openParcelChangeStream(input: {
  request: Request;
  channelName: string;
  /** Per-client cap: the web uses the client IP, the app the rider's user id. */
  limit: { key: string; max: number };
  /** Sent as the `ready` event's data once the channel is subscribed. */
  readyPayload?: unknown;
  toEvent: (change: ParcelRowChange) => Promise<ParcelStreamEvent | null>;
}): Response {
  const { request, channelName, limit, readyPayload = {}, toEvent } = input;

  if (!reserveSlot(limit.key, limit.max)) {
    return new Response(null, { status: 204 });
  }

  const supabase = getSupabaseAdminClient();
  const channel = supabase.channel(channelName);
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  // Runs once however the stream ends: client abort, channel close or cancel.
  const finish = () => {
    if (closed) {
      return false;
    }

    closed = true;
    releaseSlot(limit.key);

    if (heartbeat) {
      clearInterval(heartbeat);
    }

    void supabase.removeChannel(channel);
    return true;
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, payload: unknown) => {
        if (!closed) {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`),
          );
        }
      };
      const close = () => {
        if (finish()) {
          controller.close();
        }
      };

      request.signal.addEventListener("abort", close, { once: true });

      heartbeat = setInterval(() => {
        if (!closed) {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        }
      }, KEEPALIVE_INTERVAL_MS);

      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "parcels" },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          void (async () => {
            const event = await toEvent({
              parcelId: recordId(payload.new) ?? recordId(payload.old),
              nextRow: toParcelRealtimeRow(payload.new),
              previousRow: toParcelRealtimeRow(payload.old),
            });

            if (event) {
              send(event.type, event.payload);
            }
          })().catch((error: unknown) => {
            const message =
              error instanceof Error ? error.message : "Realtime parcel stream failed.";
            send("stream-error", { message });
          });
        },
      );

      channel.subscribe((status, error) => {
        if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
          send("ready", readyPayload);
        }

        if (
          status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR ||
          status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT
        ) {
          send("stream-error", {
            message: error?.message ?? "Realtime parcel subscription could not be established.",
          });
        }

        if (status === REALTIME_SUBSCRIBE_STATES.CLOSED) {
          close();
        }
      });
    },
    cancel() {
      finish();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    },
  });
}

function recordId(record: Record<string, unknown> | null) {
  return record && typeof record.id === "string" ? record.id : null;
}

export function toParcelRealtimeRow(
  record: Record<string, unknown> | null,
): ParcelRealtimeRow | null {
  if (!record || typeof record.id !== "string" || typeof record.merchant_id !== "string") {
    return null;
  }

  return {
    id: record.id,
    merchant_id: record.merchant_id,
    rider_id: typeof record.rider_id === "string" ? record.rider_id : null,
    status: typeof record.status === "string" ? record.status : "",
    cod_amount: typeof record.cod_amount === "number" ? record.cod_amount : 0,
    delivery_fee: typeof record.delivery_fee === "number" ? record.delivery_fee : 0,
    parcel_type: typeof record.parcel_type === "string" ? record.parcel_type : "",
    is_received_by_office: record.is_received_by_office === true,
    deleted_at: typeof record.deleted_at === "string" ? record.deleted_at : null,
  };
}
