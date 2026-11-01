import type { MobileFailureNoteResultDto } from "@/features/mobile-api/contract";
import { mobileError, mobileOk } from "@/features/mobile-api/server/response";
import { requireMobileRider } from "@/features/mobile-api/server/session";
import {
  deleteRiderDeliveryFailure,
  reportRiderDeliveryFailure,
  updateRiderDeliveryFailure,
  type RiderFailureNoteResult,
  type RiderOperationFailure,
} from "@/features/parcels/server/rider-operations";
import type { CurrentUser } from "@/lib/session";

type Context = RouteContext<"/api/mobile/v1/rider/parcels/[parcelId]/failure-note">;

const FAILED_MESSAGE = "Unable to save the failure note.";

const failureStatus = {
  invalid: 400,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  failed: 500,
} satisfies Record<RiderOperationFailure["reason"], number>;

function toResponse(result: RiderFailureNoteResult) {
  if (result.ok) {
    return mobileOk<MobileFailureNoteResultDto>(
      { parcelId: result.parcelId, activeFailureNote: result.activeFailureNote },
      result.message,
    );
  }

  if (result.reason === "not_found") {
    // Same message as the detail endpoint, so a rider can't probe for parcel ids.
    return mobileError(404, "Parcel not found.");
  }

  if (result.reason === "failed") {
    return mobileError(500, FAILED_MESSAGE);
  }

  return mobileError(failureStatus[result.reason], result.message);
}

async function handle(
  request: Request,
  ctx: Context,
  options: { readsNote: boolean },
  operation: (rider: CurrentUser, input: unknown) => Promise<RiderFailureNoteResult>,
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

  const { parcelId } = await ctx.params;
  let note: unknown;

  if (options.readsNote) {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return mobileError(400, "A valid JSON body is required.");
    }

    // Only the note comes from the body; the path names the parcel.
    note =
      typeof body === "object" && body !== null ? (body as { note?: unknown }).note : undefined;
  }

  return toResponse(await operation(session.rider, { parcelId, note }));
}

export async function POST(request: Request, ctx: Context) {
  return handle(request, ctx, { readsNote: true }, (rider, input) =>
    reportRiderDeliveryFailure(rider, input, { caller: "route-handler" }),
  );
}

export async function PATCH(request: Request, ctx: Context) {
  return handle(request, ctx, { readsNote: true }, (rider, input) =>
    updateRiderDeliveryFailure(rider, input, { caller: "route-handler" }),
  );
}

export async function DELETE(request: Request, ctx: Context) {
  return handle(request, ctx, { readsNote: false }, (rider, input) =>
    deleteRiderDeliveryFailure(rider, input, { caller: "route-handler" }),
  );
}
