"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  assignParcelsToRider,
  createParcel,
  startDeliveryForRiderParcels,
} from "@/features/parcels/server/dal";
import { createParcelFormInputSchema } from "@/features/parcels/server/dto";
import { mapCreateParcelFormInputToCreateParcelInput } from "@/features/parcels/server/utils";
import { canChangeParcelStatus, canCreateParcel } from "@/lib/permissions";
import { requireCurrentUser } from "@/lib/session";

const assignParcelsInputSchema = z.object({
  parcelIds: z.array(z.string().min(1)).min(1, "Select at least one parcel."),
  riderId: z.string().min(1, "Rider is required."),
});

const startDeliveryInputSchema = z.object({
  parcelIds: z
    .array(z.uuid("Invalid parcel selection."))
    .min(1, "Select at least one parcel."),
});

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
    await assignParcelsToRider(parseResult.data);
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
