import { randomUUID } from "node:crypto";

import { mobileError } from "@/features/mobile-api/server/response";
import { requireMobileRider } from "@/features/mobile-api/server/session";
import {
  createRiderParcelChangeTracker,
  loadParcelRealtimeScopeContext,
  loadRiderParcelIds,
} from "@/features/parcels/server/realtime";
import { openParcelChangeStream } from "@/features/parcels/server/realtime-stream";

// Per rider, not per IP: riders on one mobile carrier often share a public IP.
// Two lets a reconnect briefly overlap the stream it replaces.
const MAX_OPEN_STREAMS_PER_RIDER = 2;

export async function GET(request: Request) {
  let session;
  let scope;
  let riderParcelIds: string[];

  try {
    session = await requireMobileRider();

    if (!session.ok) {
      return session.response;
    }

    scope = await loadParcelRealtimeScopeContext(session.rider);

    if (scope.role !== "rider") {
      return mobileError(403, "Only riders can open live parcel updates.");
    }

    riderParcelIds = await loadRiderParcelIds(scope.riderId);
  } catch {
    return mobileError(500, "Unable to open live parcel updates.");
  }

  const toEvent = createRiderParcelChangeTracker(scope, riderParcelIds);

  return openParcelChangeStream({
    request,
    channelName: `parcel-flow:parcels:mobile-rider:${session.rider.id}:${randomUUID()}`,
    limit: { key: `rider:${session.rider.id}`, max: MAX_OPEN_STREAMS_PER_RIDER },
    toEvent: (change) => Promise.resolve(toEvent(change)),
  });
}
