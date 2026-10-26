import { randomUUID } from "node:crypto";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { REALTIME_SUBSCRIBE_STATES } from "@supabase/realtime-js";
import { NextResponse } from "next/server";

import {
  buildParcelRealtimeEventForScope,
  isParcelRealtimeSurface,
  loadParcelRealtimeScopeContext,
  type ParcelRealtimeRow,
} from "@/features/parcels/server/realtime";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/rate-limit";
import { requireCurrentUser } from "@/lib/session";

const encoder = new TextEncoder();

// All streams share one Supabase socket, and the free plan allows 100 channels
// per socket. Past the cap a page still works; it just stops live-updating.
const MAX_OPEN_STREAMS = 80;
const MAX_OPEN_STREAMS_PER_IP = 4;
const openStreamsByIp = new Map<string, number>();
let openStreams = 0;

function releaseStream(ip: string) {
  openStreams = Math.max(0, openStreams - 1);
  const remaining = (openStreamsByIp.get(ip) ?? 1) - 1;

  if (remaining > 0) {
    openStreamsByIp.set(ip, remaining);
  } else {
    openStreamsByIp.delete(ip);
  }
}

export async function GET(request: Request) {
  const currentUser = await requireCurrentUser();
  const { searchParams } = new URL(request.url);
  const surface = searchParams.get("surface");

  if (!surface || !isParcelRealtimeSurface(surface)) {
    return NextResponse.json(
      { message: "A valid realtime parcel surface is required." },
      { status: 400 },
    );
  }

  const ip = getClientIp(request.headers);

  if (
    openStreams >= MAX_OPEN_STREAMS ||
    (openStreamsByIp.get(ip) ?? 0) >= MAX_OPEN_STREAMS_PER_IP
  ) {
    // 204 tells EventSource to stop reconnecting instead of retrying in a loop.
    return new Response(null, { status: 204 });
  }

  openStreams += 1;
  openStreamsByIp.set(ip, (openStreamsByIp.get(ip) ?? 0) + 1);
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      releaseStream(ip);
    }
  };

  let scope: Awaited<ReturnType<typeof loadParcelRealtimeScopeContext>>;

  try {
    scope = await loadParcelRealtimeScopeContext(currentUser);
  } catch (error) {
    release();
    throw error;
  }

  const supabase = getSupabaseAdminClient();
  const channel = supabase.channel(
    `parcel-flow:parcels:${surface}:${currentUser.id}:${randomUUID()}`,
  );

  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, payload: unknown) => {
        if (closed) {
          return;
        }

        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
      };

      const cleanup = () => {
        if (closed) {
          return;
        }

        closed = true;
        release();

        if (heartbeat) {
          clearInterval(heartbeat);
        }

        void supabase.removeChannel(channel);
        controller.close();
      };

      request.signal.addEventListener("abort", cleanup, { once: true });

      heartbeat = setInterval(() => {
        if (closed) {
          return;
        }

        controller.enqueue(encoder.encode(": keepalive\n\n"));
      }, 20_000);

      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "parcels" },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          void (async () => {
            const event = await buildParcelRealtimeEventForScope({
              scope,
              surface,
              nextRow: toParcelRealtimeRow(payload.new),
              previousRow: toParcelRealtimeRow(payload.old),
            });

            if (!event) {
              return;
            }

            send(event.type, event);
          })().catch((error: unknown) => {
            const message =
              error instanceof Error ? error.message : "Realtime parcel stream failed.";
            send("stream-error", { message });
          });
        },
      );

      channel.subscribe((status, error) => {
        if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
          send("ready", { surface });
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
          cleanup();
        }
      });
    },
    cancel() {
      closed = true;
      release();

      if (heartbeat) {
        clearInterval(heartbeat);
      }

      void supabase.removeChannel(channel);
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

function toParcelRealtimeRow(record: Record<string, unknown> | null): ParcelRealtimeRow | null {
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
