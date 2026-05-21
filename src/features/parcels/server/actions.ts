"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  assignParcelsToRider,
  createParcel,
  deleteDeliveryFailureForRiderParcel,
  markRiderParcelDelivered,
  reportDeliveryFailureForRiderParcel,
  resolveFailedParcelByAdmin,
  startDeliveryForRiderParcels,
} from "@/features/parcels/server/dal";
import { createParcelFormInputSchema } from "@/features/parcels/server/dto";
import { mapCreateParcelFormInputToCreateParcelInput } from "@/features/parcels/server/utils";
import { canChangeParcelStatus, canCreateParcel } from "@/lib/permissions";
import { requireCurrentUser } from "@/lib/session";

const maxProofImageSize = 5 * 1024 * 1024;
const allowedProofImageTypes = ["image/jpeg", "image/png", "image/webp"];

const assignParcelsInputSchema = z.object({
  parcelIds: z.array(z.string().min(1)).min(1, "Select at least one parcel."),
  riderId: z.string().min(1, "Rider is required."),
});

const startDeliveryInputSchema = z.object({
  parcelIds: z.array(z.uuid("Invalid parcel selection.")).min(1, "Select at least one parcel."),
});

const reportDeliveryFailureInputSchema = z.object({
  parcelId: z.uuid("Invalid parcel selection."),
  note: z.string().trim().min(1, "Failure note is required."),
});

const deleteDeliveryFailureInputSchema = z.object({
  parcelId: z.uuid("Invalid parcel selection."),
});

const resolveFailedParcelInputSchema = z.object({
  parcelId: z.uuid("Invalid parcel selection."),
});

const markDeliveredInputSchema = z.object({
  parcelId: z.uuid("Invalid parcel selection."),
  proofImage: z
    .file("Delivery proof photo is required.")
    .min(1, "Delivery proof photo is required.")
    .max(maxProofImageSize, "Delivery proof photo must be 5MB or smaller.")
    .mime(allowedProofImageTypes, "Delivery proof photo must be a JPG, PNG, or WebP image."),
});

function normalizeFormInput(input: unknown) {
  if (!(input instanceof FormData)) {
    return input;
  }

  return {
    parcelId: input.get("parcelId"),
    note: input.get("note"),
    proofImage: input.get("proofImage"),
  };
}

export async function createParcelAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = createParcelFormInputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid parcel details.",
    };
  }

  if (!canCreateParcel(actor.role)) {
    return {
      ok: false as const,
      message: "You do not have permission to create parcels.",
    };
  }

  const validatedInput = parseResult.data;
  const parcel = mapCreateParcelFormInputToCreateParcelInput(validatedInput);
  const createdParcel = await createParcel({
    ...parcel,
    createdBy: actor.id,
  });

  revalidatePath("/dashboard/parcels");

  return {
    ok: true as const,
    message: "Parcel created.",
    parcel: {
      ...parcel,
      id: createdParcel.id,
      parcelCode: createdParcel.parcelCode,
    },
  };
}

export async function assignParcelsToRiderAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = assignParcelsInputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid assignment details.",
    };
  }

  if (!canCreateParcel(actor.role)) {
    return {
      ok: false as const,
      message: "You do not have permission to assign parcels.",
    };
  }

  try {
    await assignParcelsToRider({ ...parseResult.data, actorId: actor.id });
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Unable to assign parcels.",
    };
  }

  revalidatePath("/dashboard/parcels");
  revalidatePath("/dashboard/riders");
  revalidatePath("/dashboard/rider/parcels");

  return {
    ok: true as const,
    message: "Parcels assigned.",
  };
}

async function resolveFailedParcelAction(
  input: unknown,
  targetStatus: "postpone" | "canceled_returned",
) {
  const actor = await requireCurrentUser();
  const parseResult = resolveFailedParcelInputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid failure resolution details.",
    };
  }

  if (!canChangeParcelStatus(actor.role, "on_the_way", targetStatus)) {
    return {
      ok: false as const,
      message: "You do not have permission to resolve failed parcels.",
    };
  }

  try {
    await resolveFailedParcelByAdmin({
      parcelId: parseResult.data.parcelId,
      targetStatus,
      actorId: actor.id,
      actorRole: actor.role,
    });
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Unable to resolve failed parcel.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/parcels");
  revalidatePath("/dashboard/riders");
  revalidatePath("/dashboard/rider/parcels");

  return {
    ok: true as const,
    message:
      targetStatus === "postpone"
        ? "Parcel postponed for retry."
        : "Parcel marked for merchant return.",
  };
}

export async function postponeFailedParcelAction(input: unknown) {
  return resolveFailedParcelAction(input, "postpone");
}

export async function returnFailedParcelToMerchantAction(input: unknown) {
  return resolveFailedParcelAction(input, "canceled_returned");
}

export async function startDeliveryForRiderParcelsAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = startDeliveryInputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid start delivery details.",
    };
  }

  if (actor.role !== "rider" || !canChangeParcelStatus(actor.role, "at_office", "on_the_way")) {
    return {
      ok: false as const,
      message: "You do not have permission to start delivery.",
    };
  }

  try {
    await startDeliveryForRiderParcels({
      parcelIds: parseResult.data.parcelIds,
      riderUserId: actor.id,
      actorRole: actor.role,
    });
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Unable to start delivery.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/parcels");
  revalidatePath("/dashboard/rider/parcels");

  return {
    ok: true as const,
    message:
      parseResult.data.parcelIds.length === 1
        ? "Parcel moved to on the way."
        : "Selected parcels moved to on the way.",
  };
}

export async function reportDeliveryFailureForRiderParcelAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = reportDeliveryFailureInputSchema.safeParse(normalizeFormInput(input));

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid failure report details.",
    };
  }

  if (actor.role !== "rider") {
    return {
      ok: false as const,
      message: "You do not have permission to report delivery failure.",
    };
  }

  try {
    await reportDeliveryFailureForRiderParcel({
      parcelId: parseResult.data.parcelId,
      note: parseResult.data.note,
      riderUserId: actor.id,
      actorRole: actor.role,
    });
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Unable to report delivery failure.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/parcels");
  revalidatePath("/dashboard/rider/parcels");

  return {
    ok: true as const,
    message: "Delivery failure reported.",
  };
}

export async function deleteDeliveryFailureForRiderParcelAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = deleteDeliveryFailureInputSchema.safeParse(normalizeFormInput(input));

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid failure note details.",
    };
  }

  if (actor.role !== "rider") {
    return {
      ok: false as const,
      message: "You do not have permission to delete delivery failure notes.",
    };
  }

  try {
    await deleteDeliveryFailureForRiderParcel({
      parcelId: parseResult.data.parcelId,
      riderUserId: actor.id,
      actorRole: actor.role,
    });
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Unable to delete delivery failure note.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/parcels");
  revalidatePath("/dashboard/rider/parcels");

  return {
    ok: true as const,
    message: "Delivery failure note deleted.",
  };
}

export async function markRiderParcelDeliveredAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = markDeliveredInputSchema.safeParse(normalizeFormInput(input));

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid delivery confirmation details.",
    };
  }

  if (actor.role !== "rider" || !canChangeParcelStatus(actor.role, "on_the_way", "delivered")) {
    return {
      ok: false as const,
      message: "You do not have permission to mark parcels delivered.",
    };
  }

  try {
    const { uploadDeliveryProofImage } = await import("@/features/parcels/server/upload");
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
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Unable to mark parcel delivered.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/parcels");
  revalidatePath("/dashboard/rider/parcels");

  return {
    ok: true as const,
    message: "Parcel marked delivered.",
  };
}
