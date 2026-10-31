import type { MobileMarkDeliveredResultDto } from "@/features/mobile-api/contract";
import { mobileError, mobileOk } from "@/features/mobile-api/server/response";
import { requireMobileRider } from "@/features/mobile-api/server/session";
import {
  markRiderParcelDelivered,
  PROOF_UPLOAD_FAILED_MESSAGE,
  type RiderUploadOperationFailure,
} from "@/features/parcels/server/rider-operations";

const failureStatus = {
  invalid: 400,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  failed: 500,
} satisfies Record<RiderUploadOperationFailure["reason"], number>;

function toErrorResponse(failure: RiderUploadOperationFailure) {
  if (failure.reason === "not_found") {
    // Same message as the detail endpoint, so a rider can't probe for parcel ids.
    return mobileError(404, "Parcel not found.");
  }

  if (failure.reason === "failed") {
    // Only the photo upload message is safe to pass on; anything else may
    // carry internal details.
    return mobileError(
      500,
      failure.message === PROOF_UPLOAD_FAILED_MESSAGE
        ? failure.message
        : "Unable to mark parcel delivered.",
    );
  }

  return mobileError(failureStatus[failure.reason], failure.message);
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/mobile/v1/rider/parcels/[parcelId]/deliver">,
) {
  let result;

  try {
    result = await requireMobileRider();
  } catch {
    return mobileError(500, "Unable to mark parcel delivered.");
  }

  if (!result.ok) {
    return result.response;
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return mobileError(400, "A valid multipart form payload is required.");
  }

  const delivered = await markRiderParcelDelivered(result.rider, {
    parcelId: (await ctx.params).parcelId,
    proofImage: formData.get("proofImage"),
  });

  if (!delivered.ok) {
    return toErrorResponse(delivered);
  }

  return mobileOk<MobileMarkDeliveredResultDto>(
    { parcelId: delivered.parcelId },
    delivered.message,
  );
}
