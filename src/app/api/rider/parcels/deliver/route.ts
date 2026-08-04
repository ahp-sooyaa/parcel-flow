import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { markRiderParcelDelivered } from "@/features/parcels/server/dal";
import { uploadDeliveryProofImage } from "@/features/parcels/server/upload";
import { revalidateParcelWriteCaches } from "@/lib/cache-invalidation";
import { canChangeParcelStatus } from "@/lib/permissions";
import { requireCurrentUser } from "@/lib/session";

const maxProofImageSize = 5 * 1024 * 1024;
const allowedProofImageTypes = ["image/jpeg", "image/png", "image/webp"];

const markDeliveredInputSchema = z.object({
  parcelId: z.uuid("Invalid parcel selection."),
  proofImage: z
    .file("Delivery proof photo is required.")
    .min(1, "Delivery proof photo is required.")
    .max(maxProofImageSize, "Delivery proof photo must be 5MB or smaller.")
    .mime(allowedProofImageTypes, "Delivery proof photo must be a JPG, PNG, or WebP image."),
});

export async function POST(request: Request) {
  let actor;

  try {
    actor = await requireCurrentUser();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication required.";

    return NextResponse.json({ ok: false, message }, { status: 401 });
  }

  if (actor.role !== "rider" || !canChangeParcelStatus(actor.role, "on_the_way", "delivered")) {
    return NextResponse.json(
      {
        ok: false,
        message: "You do not have permission to mark parcels delivered.",
      },
      { status: 403 },
    );
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

  const parseResult = markDeliveredInputSchema.safeParse({
    parcelId: formData.get("parcelId"),
    proofImage: formData.get("proofImage"),
  });

  if (!parseResult.success) {
    return NextResponse.json(
      {
        ok: false,
        message: parseResult.error.issues[0]?.message ?? "Invalid delivery confirmation details.",
      },
      { status: 400 },
    );
  }

  try {
    const proofImageKey = await uploadDeliveryProofImage({
      parcelId: parseResult.data.parcelId,
      file: parseResult.data.proofImage,
    });

    await markRiderParcelDelivered({
      parcelId: parseResult.data.parcelId,
      proofImageKey,
      riderUserId: actor.id,
      actorRole: actor.role,
      createdBy: actor.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to mark parcel delivered.",
      },
      { status: 500 },
    );
  }

  revalidateParcelWriteCaches({ riderUserId: actor.id });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/parcels");
  revalidatePath("/dashboard/rider/parcels");

  return NextResponse.json({
    ok: true,
    message: "Parcel marked delivered.",
  });
}
