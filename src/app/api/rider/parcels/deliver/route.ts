import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { markRiderParcelDelivered } from "@/features/parcels/server/dal";
import { uploadDeliveryProofImage } from "@/features/parcels/server/upload";
import { revalidateParcelWriteCaches } from "@/lib/cache-invalidation";
import { isDemoMode, pickDemoProofImageKey } from "@/lib/demo";
import { canChangeParcelStatus } from "@/lib/permissions";
import { createRateLimiter } from "@/lib/rate-limit";
import { requireCurrentUser } from "@/lib/session";

const maxProofImageSize = 5 * 1024 * 1024;
const allowedProofImageTypes = ["image/jpeg", "image/png", "image/webp"];

const deliverLimiter = createRateLimiter({ capacity: 30, refillPerMinute: 30 });

const proofImageSchema = z
  .file("Delivery proof photo is required.")
  .min(1, "Delivery proof photo is required.")
  .max(maxProofImageSize, "Delivery proof photo must be 5MB or smaller.")
  .mime(allowedProofImageTypes, "Delivery proof photo must be a JPG, PNG, or WebP image.");

const markDeliveredInputSchema = z.object({
  parcelId: z.uuid("Invalid parcel selection."),
  proofImage: proofImageSchema,
});

// The public demo never stores uploads; a seeded sample photo stands in.
const demoMarkDeliveredInputSchema = markDeliveredInputSchema.extend({
  proofImage: z.unknown().transform(() => undefined),
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

  if (isDemoMode() && !deliverLimiter.take(actor.id)) {
    return NextResponse.json(
      { ok: false, message: "Too many requests. Try again in a minute." },
      { status: 429 },
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

  const demoMode = isDemoMode();
  const inputSchema: typeof markDeliveredInputSchema | typeof demoMarkDeliveredInputSchema =
    demoMode ? demoMarkDeliveredInputSchema : markDeliveredInputSchema;
  const parseResult = inputSchema.safeParse({
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
    const proofImage = parseResult.data.proofImage;
    const proofImageKey =
      demoMode || !proofImage
        ? pickDemoProofImageKey(parseResult.data.parcelId)
        : await uploadDeliveryProofImage({
            parcelId: parseResult.data.parcelId,
            file: proofImage,
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
