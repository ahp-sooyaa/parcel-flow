"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  assignParcelsToRider,
  correctParcelRider,
  correctParcelStatus,
  createParcel,
  deleteDeliveryFailureForRiderParcel,
  getParcelByIdForRealtimeScope,
  markRiderParcelReturnedToMerchant,
  reportDeliveryFailureForRiderParcel,
  resolveFailedParcelByAdmin,
  updateDeliveryFailureForRiderParcel,
  updateParcel,
} from "@/features/parcels/server/dal";
import {
  correctParcelRiderInputSchema,
  correctParcelStatusInputSchema,
  createParcelFormInputSchema,
  updateParcelFormInputSchema,
} from "@/features/parcels/server/dto";
import { startRiderDelivery } from "@/features/parcels/server/rider-operations";
import {
  deleteDeliveryProofImage,
  uploadDeliveryProofImage,
} from "@/features/parcels/server/upload";
import {
  mapCreateParcelFormInputToCreateParcelInput,
  mapUpdateParcelFormInputToUpdateParcelInput,
} from "@/features/parcels/server/utils";
import {
  invalidateParcelWriteCaches,
  revalidateParcelOperationalPaths,
} from "@/lib/cache-invalidation";
import { getFormFieldErrors } from "@/lib/form-action-errors";
import { isAdminRole } from "@/lib/domain";
import { canChangeParcelStatus, canCreateParcel } from "@/lib/permissions";
import { isDemoMode, pickDemoProofImageKey } from "@/lib/demo";
import { requireCurrentUser } from "@/lib/session";
import { maxLengthMessage, TEXT_LIMITS } from "@/lib/validation";

const assignParcelsInputSchema = z.object({
  parcelIds: z.array(z.string().min(1)).min(1, "Select at least one parcel."),
  riderId: z.string().min(1, "Rider is required."),
});

const reportDeliveryFailureInputSchema = z.object({
  parcelId: z.uuid("Invalid parcel selection."),
  note: z
    .string()
    .trim()
    .min(1, "Failure note is required.")
    .max(TEXT_LIMITS.note, maxLengthMessage("Failure note", TEXT_LIMITS.note)),
});

const deleteDeliveryFailureInputSchema = z.object({
  parcelId: z.uuid("Invalid parcel selection."),
});

const updateDeliveryFailureInputSchema = z.object({
  parcelId: z.uuid("Invalid parcel selection."),
  note: z
    .string()
    .trim()
    .min(1, "Failure note is required.")
    .max(TEXT_LIMITS.note, maxLengthMessage("Failure note", TEXT_LIMITS.note)),
});

const resolveFailedParcelInputSchema = z.object({
  parcelId: z.uuid("Invalid parcel selection."),
});

const maxCorrectionProofImageSize = 5 * 1024 * 1024;
const allowedCorrectionProofImageTypes = ["image/jpeg", "image/png", "image/webp"] as const;
const optionalCorrectionProofImageSchema = z.preprocess(
  (value) => (value instanceof File && value.size > 0 ? value : undefined),
  z
    .file("Delivery proof photo is required.")
    .max(maxCorrectionProofImageSize, "Delivery proof photo must be 5MB or smaller.")
    .mime(
      [...allowedCorrectionProofImageTypes],
      "Delivery proof photo must be a JPG, PNG, or WebP image.",
    )
    .optional(),
);
const correctParcelStatusFormInputSchema = correctParcelStatusInputSchema.extend({
  proofImage: optionalCorrectionProofImageSchema,
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

function normalizeCorrectParcelStatusInput(input: unknown) {
  if (!(input instanceof FormData)) {
    return input;
  }

  return {
    parcelId: input.get("parcelId"),
    expectedStatus: input.get("expectedStatus"),
    expectedRiderId: input.get("expectedRiderId"),
    expectedFinancialItemsFingerprint: input.get("expectedFinancialItemsFingerprint"),
    targetStatus: input.get("targetStatus"),
    targetRiderId: input.get("targetRiderId"),
    proofImage: input.get("proofImage"),
    reason: input.get("reason"),
  };
}

export async function createParcelAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = createParcelFormInputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid parcel details.",
      fieldErrors: getFormFieldErrors(parseResult.error),
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

  invalidateParcelWriteCaches();
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

export async function updateParcelAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = updateParcelFormInputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid parcel details.",
      fieldErrors: getFormFieldErrors(parseResult.error),
    };
  }

  if (!canCreateParcel(actor.role)) {
    return {
      ok: false as const,
      message: "You do not have permission to edit parcels.",
    };
  }

  if (actor.role !== "super_admin" && actor.role !== "office_admin") {
    return {
      ok: false as const,
      message: "You do not have permission to edit parcels.",
    };
  }

  try {
    await updateParcel(mapUpdateParcelFormInputToUpdateParcelInput(parseResult.data));
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Unable to update parcel.",
    };
  }

  revalidateParcelOperationalPaths({ caller: "server-action" });

  return {
    ok: true as const,
    message: "Parcel updated.",
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

  invalidateParcelWriteCaches();
  revalidatePath("/dashboard/parcels");
  revalidatePath("/dashboard/riders");
  revalidatePath("/dashboard/rider/parcels");

  return {
    ok: true as const,
    message: "Parcels assigned.",
  };
}

function revalidateParcelCorrectionPaths() {
  invalidateParcelWriteCaches();
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/parcels");
  revalidatePath("/dashboard/riders");
  revalidatePath("/dashboard/settlements");
  revalidatePath("/dashboard/rider-payouts");
  revalidatePath("/dashboard/merchant/parcels");
  revalidatePath("/dashboard/rider/parcels");
}

export async function correctParcelStatusAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = correctParcelStatusFormInputSchema.safeParse(
    normalizeCorrectParcelStatusInput(input),
  );

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid parcel correction details.",
      fieldErrors: getFormFieldErrors(parseResult.error),
    };
  }

  if (actor.role !== "super_admin" && actor.role !== "office_admin") {
    return {
      ok: false as const,
      message: "You do not have permission to correct parcels.",
    };
  }

  let uploadedProofImageKey: string | undefined;

  try {
    const { proofImage, ...correctionInput } = parseResult.data;
    const isDeliveredCorrection = correctionInput.targetStatus === "delivered";
    // The public demo never stores uploads; a seeded sample photo stands in.
    const demoProofImageKey =
      isDemoMode() && isDeliveredCorrection
        ? pickDemoProofImageKey(correctionInput.parcelId)
        : undefined;
    uploadedProofImageKey =
      !demoProofImageKey && proofImage && isDeliveredCorrection
        ? await uploadDeliveryProofImage({
            parcelId: correctionInput.parcelId,
            file: proofImage,
          })
        : undefined;

    await correctParcelStatus({
      ...correctionInput,
      proofImageKey: demoProofImageKey ?? uploadedProofImageKey,
      actorId: actor.id,
      actorRole: actor.role,
    });
  } catch (error) {
    if (uploadedProofImageKey) {
      await deleteDeliveryProofImage(uploadedProofImageKey).catch(() => undefined);
    }

    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Unable to correct parcel status.",
    };
  }

  revalidateParcelCorrectionPaths();

  return {
    ok: true as const,
    message: "Parcel status corrected.",
  };
}

export async function correctParcelRiderAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = correctParcelRiderInputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid parcel rider correction details.",
      fieldErrors: getFormFieldErrors(parseResult.error),
    };
  }

  if (actor.role !== "super_admin" && actor.role !== "office_admin") {
    return {
      ok: false as const,
      message: "You do not have permission to correct parcels.",
    };
  }

  try {
    await correctParcelRider({
      ...parseResult.data,
      actorId: actor.id,
      actorRole: actor.role,
    });
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Unable to correct parcel rider.",
    };
  }

  revalidateParcelCorrectionPaths();

  return {
    ok: true as const,
    message: "Parcel rider corrected.",
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

  revalidateParcelOperationalPaths({ caller: "server-action" });

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
  const result = await startRiderDelivery(actor, input, { caller: "server-action" });

  return result.ok
    ? { ok: true as const, message: result.message }
    : { ok: false as const, message: result.message };
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

  revalidateParcelOperationalPaths({ caller: "server-action" });

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

  revalidateParcelOperationalPaths({ caller: "server-action" });

  return {
    ok: true as const,
    message: "Delivery failure note deleted.",
  };
}

export async function updateDeliveryFailureForRiderParcelAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = updateDeliveryFailureInputSchema.safeParse(normalizeFormInput(input));

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid failure note details.",
    };
  }

  if (actor.role !== "rider") {
    return {
      ok: false as const,
      message: "You do not have permission to update delivery failure notes.",
    };
  }

  try {
    await updateDeliveryFailureForRiderParcel({
      parcelId: parseResult.data.parcelId,
      note: parseResult.data.note,
      riderUserId: actor.id,
      actorRole: actor.role,
    });
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Unable to update delivery failure note.",
    };
  }

  revalidateParcelOperationalPaths({ caller: "server-action" });

  return {
    ok: true as const,
    message: "Delivery failure note updated.",
  };
}

export async function markRiderParcelReturnedToMerchantAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = resolveFailedParcelInputSchema.safeParse(normalizeFormInput(input));

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid return completion details.",
    };
  }

  if (
    actor.role !== "rider" ||
    !canChangeParcelStatus(actor.role, "canceled_returned", "returned_to_merchant")
  ) {
    return {
      ok: false as const,
      message: "You do not have permission to complete parcel returns.",
    };
  }

  try {
    await markRiderParcelReturnedToMerchant({
      parcelId: parseResult.data.parcelId,
      riderUserId: actor.id,
      actorRole: actor.role,
      createdBy: actor.id,
    });
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "Unable to complete parcel return.",
    };
  }

  revalidateParcelOperationalPaths({ caller: "server-action" });

  return {
    ok: true as const,
    message: "Parcel returned to merchant.",
  };
}

const parcelIdSchema = z.uuid("Invalid parcel selection.");

export async function getAdminParcelDetailAction(parcelId: unknown) {
  const actor = await requireCurrentUser();

  if (!isAdminRole(actor.role)) {
    throw new Error("Admin access required.");
  }

  const parsedParcelId = parcelIdSchema.parse(parcelId);
  const parcel = await getParcelByIdForRealtimeScope(parsedParcelId, { role: actor.role });

  if (!parcel) {
    throw new Error("Parcel was not found.");
  }

  return parcel;
}
