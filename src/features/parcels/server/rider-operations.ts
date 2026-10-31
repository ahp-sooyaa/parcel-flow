// Rider parcel writes shared by the web server actions and the mobile API
// route handlers, so both apply one set of rules. Not a "use server" module:
// these take an already-authenticated actor and must not be callable directly.
// See docs/mobile-app.md ("Shared operation layer").
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import {
  getParcelByIdForRealtimeScope,
  markRiderParcelDelivered as markRiderParcelDeliveredInDatabase,
  startDeliveryForRiderParcels,
} from "@/features/parcels/server/dal";
import { ParcelOperationError } from "@/features/parcels/server/errors";
import {
  deleteDeliveryProofImage,
  uploadDeliveryProofImage,
} from "@/features/parcels/server/upload";
import {
  revalidateParcelOperationalPaths,
  type ParcelOperationCaller,
} from "@/lib/cache-invalidation";
import { isDemoMode, pickDemoProofImageKey } from "@/lib/demo";
import { canChangeParcelStatus } from "@/lib/permissions";
import { createRateLimiter } from "@/lib/rate-limit";
import type { CurrentUser } from "@/lib/session";

export const MAX_START_DELIVERY_PARCELS = 50;

export const startDeliveryInputSchema = z.object({
  parcelIds: z
    .array(z.uuid("Invalid parcel selection."))
    .min(1, "Select at least one parcel.")
    .max(MAX_START_DELIVERY_PARCELS, "Select up to 50 parcels at a time."),
});

export type RiderOperationFailureReason =
  | "invalid"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "failed";

export type RiderOperationFailure = {
  ok: false;
  reason: RiderOperationFailureReason;
  message: string;
};

export type RiderUploadOperationFailure = {
  ok: false;
  reason: RiderOperationFailureReason | "rate_limited";
  message: string;
};

export type StartRiderDeliveryResult =
  | { ok: true; message: string; parcelIds: string[] }
  | RiderOperationFailure;

function toFailure(error: unknown, fallbackMessage: string): RiderOperationFailure {
  if (error instanceof ParcelOperationError) {
    return {
      ok: false,
      // Another rider's parcel is reported like a missing one to callers that
      // hide the difference; the message still tells the web rider which it was.
      reason: error.code === "not_assigned" ? "not_found" : error.code,
      message: error.message,
    };
  }

  return {
    ok: false,
    reason: "failed",
    message: error instanceof Error ? error.message : fallbackMessage,
  };
}

/** Moves the rider's assigned `at_office` parcels to `on_the_way`, all or nothing. */
export async function startRiderDelivery(
  actor: CurrentUser,
  input: unknown,
  options: { caller: ParcelOperationCaller },
): Promise<StartRiderDeliveryResult> {
  const parseResult = startDeliveryInputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false,
      reason: "invalid",
      message: parseResult.error.issues[0]?.message ?? "Invalid start delivery details.",
    };
  }

  if (actor.role !== "rider" || !canChangeParcelStatus(actor.role, "at_office", "on_the_way")) {
    return {
      ok: false,
      reason: "forbidden",
      message: "You do not have permission to start delivery.",
    };
  }

  const parcelIds = Array.from(new Set(parseResult.data.parcelIds));

  try {
    await startDeliveryForRiderParcels({
      parcelIds,
      riderUserId: actor.id,
      actorRole: actor.role,
    });
  } catch (error) {
    return toFailure(error, "Unable to start delivery.");
  }

  revalidateParcelOperationalPaths({ caller: options.caller, riderUserId: actor.id });

  return {
    ok: true,
    message:
      parseResult.data.parcelIds.length === 1
        ? "Parcel moved to on the way."
        : "Selected parcels moved to on the way.",
    parcelIds,
  };
}

export const MAX_PROOF_IMAGE_BYTES = 5 * 1024 * 1024;
export const PROOF_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const proofImageSchema = z
  .file("Delivery proof photo is required.")
  .min(1, "Delivery proof photo is required.")
  .max(MAX_PROOF_IMAGE_BYTES, "Delivery proof photo must be 5MB or smaller.")
  .mime([...PROOF_IMAGE_TYPES], "Delivery proof photo must be a JPG, PNG, or WebP image.");

const markDeliveredInputSchema = z.object({
  parcelId: z.uuid("Invalid parcel selection."),
  proofImage: proofImageSchema,
});

// The public demo never stores uploads; a seeded sample photo stands in.
const demoMarkDeliveredInputSchema = markDeliveredInputSchema.extend({
  proofImage: z.unknown().transform(() => undefined),
});

// One budget per rider across the web and mobile delivery routes.
const demoDeliverLimiter = createRateLimiter({ capacity: 30, refillPerMinute: 30 });

export const PROOF_UPLOAD_FAILED_MESSAGE = "Couldn't save the delivery photo. Try again.";

export type MarkRiderParcelDeliveredResult =
  | { ok: true; message: string; parcelId: string }
  | RiderUploadOperationFailure;

/**
 * Marks the rider's assigned `on_the_way` parcel delivered with a proof photo.
 * Both callers are route handlers, so caches are expired immediately.
 */
export async function markRiderParcelDelivered(
  actor: CurrentUser,
  input: { parcelId: unknown; proofImage: unknown },
): Promise<MarkRiderParcelDeliveredResult> {
  if (actor.role !== "rider" || !canChangeParcelStatus(actor.role, "on_the_way", "delivered")) {
    return {
      ok: false,
      reason: "forbidden",
      message: "You do not have permission to mark parcels delivered.",
    };
  }

  const demoMode = isDemoMode();

  if (demoMode && !demoDeliverLimiter.take(actor.id)) {
    return {
      ok: false,
      reason: "rate_limited",
      message: "Too many requests. Try again in a minute.",
    };
  }

  const inputSchema: typeof markDeliveredInputSchema | typeof demoMarkDeliveredInputSchema =
    demoMode ? demoMarkDeliveredInputSchema : markDeliveredInputSchema;
  const parseResult = inputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false,
      reason: "invalid",
      message: parseResult.error.issues[0]?.message ?? "Invalid delivery confirmation details.",
    };
  }

  const { parcelId, proofImage } = parseResult.data;

  // Reject requests that can't succeed before storing their photo. The DAL
  // checks again under its row lock, so this is only an early exit.
  const precheck = await checkParcelDeliverable(actor.id, parcelId);

  if (precheck) {
    return precheck;
  }

  let proofImageKey: string;
  let uploadedProofImageKey: string | null = null;

  try {
    if (demoMode || !proofImage) {
      proofImageKey = pickDemoProofImageKey(parcelId);
    } else {
      proofImageKey = await uploadDeliveryProofImage({ parcelId, file: proofImage });
      uploadedProofImageKey = proofImageKey;
    }
  } catch {
    return { ok: false, reason: "failed", message: PROOF_UPLOAD_FAILED_MESSAGE };
  }

  try {
    await markRiderParcelDeliveredInDatabase({
      parcelId,
      proofImageKey,
      riderUserId: actor.id,
      actorRole: actor.role,
      createdBy: actor.id,
    });
  } catch (error) {
    if (uploadedProofImageKey) {
      await removeOrphanedProofImage(uploadedProofImageKey);
    }

    return toFailure(error, "Unable to mark parcel delivered.");
  }

  revalidateParcelOperationalPaths({ caller: "route-handler", riderUserId: actor.id });

  return { ok: true, message: "Parcel marked delivered.", parcelId };
}

async function checkParcelDeliverable(
  riderUserId: string,
  parcelId: string,
): Promise<RiderOperationFailure | null> {
  let parcel;

  try {
    parcel = await getParcelByIdForRealtimeScope(parcelId, { role: "rider", userId: riderUserId });
  } catch (error) {
    return toFailure(error, "Unable to mark parcel delivered.");
  }

  if (!parcel) {
    return { ok: false, reason: "not_found", message: "Parcel was not found." };
  }

  if (parcel.status !== "on_the_way") {
    return {
      ok: false,
      reason: "conflict",
      message: "Only on-the-way parcels can be marked delivered.",
    };
  }

  if (parcel.activeFailureNote) {
    return {
      ok: false,
      reason: "conflict",
      message: "Resolve the delivery failure note before marking this parcel delivered.",
    };
  }

  return null;
}

async function removeOrphanedProofImage(objectKey: string) {
  try {
    await deleteDeliveryProofImage(objectKey);
  } catch (error) {
    // The delivery failure is what the rider needs to hear about; a leftover
    // photo is only storage, so record it and move on.
    Sentry.captureException(error);
    console.error("Unable to delete an orphaned delivery proof photo.", objectKey, error);
  }
}
