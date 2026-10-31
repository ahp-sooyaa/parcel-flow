import { NextResponse } from "next/server";

import {
  markRiderParcelDelivered,
  type RiderUploadOperationFailure,
} from "@/features/parcels/server/rider-operations";
import { requireCurrentUser } from "@/lib/session";

// The web rider card only reads the JSON body; these statuses are kept as they
// were before the rules moved to the shared rider operation.
const failureStatus = {
  forbidden: 403,
  rate_limited: 429,
  invalid: 400,
  not_found: 500,
  conflict: 500,
  failed: 500,
} satisfies Record<RiderUploadOperationFailure["reason"], number>;

export async function POST(request: Request) {
  let actor;

  try {
    actor = await requireCurrentUser();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication required.";

    return NextResponse.json({ ok: false, message }, { status: 401 });
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, message: "A valid multipart form payload is required." },
      { status: 400 },
    );
  }

  const result = await markRiderParcelDelivered(actor, {
    parcelId: formData.get("parcelId"),
    proofImage: formData.get("proofImage"),
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: result.message },
      { status: failureStatus[result.reason] },
    );
  }

  return NextResponse.json({ ok: true, message: result.message });
}
