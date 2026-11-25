import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import {
  buildParcelRealtimeEventForScope,
  isParcelRealtimeSurface,
  loadParcelRealtimeScopeContext,
} from "@/features/parcels/server/realtime";
import { openParcelChangeStream } from "@/features/parcels/server/realtime-stream";
import { getClientIp } from "@/lib/rate-limit";
import { requireCurrentUser } from "@/lib/session";

const MAX_OPEN_STREAMS_PER_IP = 4;

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

  const scope = await loadParcelRealtimeScopeContext(currentUser);

  return openParcelChangeStream({
    request,
    channelName: `parcel-flow:parcels:${surface}:${currentUser.id}:${randomUUID()}`,
    limit: { key: `ip:${getClientIp(request.headers)}`, max: MAX_OPEN_STREAMS_PER_IP },
    readyPayload: { surface },
    toEvent: async ({ nextRow, previousRow }) => {
      const event = await buildParcelRealtimeEventForScope({
        scope,
        surface,
        nextRow,
        previousRow,
      });

      return event ? { type: event.type, payload: event } : null;
    },
  });
}
