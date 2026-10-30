import { z } from "zod";

import { toMobileRiderParcelDetail } from "@/features/mobile-api/server/parcels";
import { mobileError, mobileOk } from "@/features/mobile-api/server/response";
import { requireMobileRider } from "@/features/mobile-api/server/session";
import { getParcelByIdForRealtimeScope } from "@/features/parcels/server/dal";

const parcelIdSchema = z.uuid();

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/mobile/v1/rider/parcels/[parcelId]">,
) {
  let result;

  try {
    result = await requireMobileRider();
  } catch {
    return mobileError(500, "Unable to load this parcel.");
  }

  if (!result.ok) {
    return result.response;
  }

  const parcelId = parcelIdSchema.safeParse((await ctx.params).parcelId);

  if (!parcelId.success) {
    return mobileError(400, "Invalid parcel id.");
  }

  try {
    const parcel = await getParcelByIdForRealtimeScope(parcelId.data, {
      role: "rider",
      userId: result.rider.id,
    });

    // Missing, deleted and someone else's parcel all look the same, so a rider
    // can't probe for parcel ids.
    if (!parcel) {
      return mobileError(404, "Parcel not found.");
    }

    return mobileOk(toMobileRiderParcelDetail(parcel), "Parcel loaded.");
  } catch {
    return mobileError(500, "Unable to load this parcel.");
  }
}
