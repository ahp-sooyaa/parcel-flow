import type { MobileReturnToMerchantResultDto } from "@/features/mobile-api/contract";
import { mobileError, mobileOk } from "@/features/mobile-api/server/response";
import { requireMobileRider } from "@/features/mobile-api/server/session";
import {
  returnRiderParcelToMerchant,
  type RiderOperationFailure,
} from "@/features/parcels/server/rider-operations";

const FAILED_MESSAGE = "Unable to complete parcel return.";

const failureStatus = {
  invalid: 400,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  failed: 500,
} satisfies Record<RiderOperationFailure["reason"], number>;

function toErrorResponse(failure: RiderOperationFailure) {
  if (failure.reason === "not_found") {
    // Same message as the detail endpoint, so a rider can't probe for parcel ids.
    return mobileError(404, "Parcel not found.");
  }

  if (failure.reason === "failed") {
    return mobileError(500, FAILED_MESSAGE);
  }

  return mobileError(failureStatus[failure.reason], failure.message);
}

// No body: the path names the parcel, and there is nothing else to send.
export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/mobile/v1/rider/parcels/[parcelId]/return">,
) {
  let session;

  try {
    session = await requireMobileRider();
  } catch {
    return mobileError(500, FAILED_MESSAGE);
  }

  if (!session.ok) {
    return session.response;
  }

  const returned = await returnRiderParcelToMerchant(
    session.rider,
    { parcelId: (await ctx.params).parcelId },
    { caller: "route-handler" },
  );

  if (!returned.ok) {
    return toErrorResponse(returned);
  }

  return mobileOk<MobileReturnToMerchantResultDto>(
    { parcelId: returned.parcelId },
    returned.message,
  );
}
