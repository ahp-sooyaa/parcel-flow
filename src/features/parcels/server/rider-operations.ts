// Rider parcel writes shared by the web server actions and the mobile API
// route handlers, so both apply one set of rules. Not a "use server" module:
// these take an already-authenticated actor and must not be callable directly.
// See docs/mobile-app.md ("Shared operation layer").
import { z } from "zod";

import { startDeliveryForRiderParcels } from "@/features/parcels/server/dal";
import { ParcelOperationError } from "@/features/parcels/server/errors";
import {
  revalidateParcelOperationalPaths,
  type ParcelOperationCaller,
} from "@/lib/cache-invalidation";
import { canChangeParcelStatus } from "@/lib/permissions";
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
