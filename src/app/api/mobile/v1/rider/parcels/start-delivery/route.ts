import type { MobileStartDeliveryResultDto } from "@/features/mobile-api/contract";
import { mobileError, mobileOk } from "@/features/mobile-api/server/response";
import { requireMobileRider } from "@/features/mobile-api/server/session";
import {
  startRiderDelivery,
  type RiderOperationFailure,
} from "@/features/parcels/server/rider-operations";

const failureStatus = {
  invalid: 400,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  failed: 500,
} satisfies Record<RiderOperationFailure["reason"], number>;

function toErrorResponse(failure: RiderOperationFailure) {
  if (failure.reason === "not_found") {
    // Missing and someone else's parcel look the same, so a rider can't probe
    // for parcel ids.
    return mobileError(404, "One or more selected parcels were not found.");
  }

  if (failure.reason === "failed") {
    return mobileError(500, "Unable to start delivery.");
  }

  return mobileError(failureStatus[failure.reason], failure.message);
}

export async function POST(request: Request) {
  let result;

  try {
    result = await requireMobileRider();
  } catch {
    return mobileError(500, "Unable to start delivery.");
  }

  if (!result.ok) {
    return result.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return mobileError(400, "A valid JSON body is required.");
  }

  const started = await startRiderDelivery(result.rider, body, { caller: "route-handler" });

  if (!started.ok) {
    return toErrorResponse(started);
  }

  return mobileOk<MobileStartDeliveryResultDto>({ parcelIds: started.parcelIds }, started.message);
}
