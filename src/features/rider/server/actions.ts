"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createRider, findActiveRiderAppUserById, findRiderByLinkedAppUserId } from "./dal";
import { createRiderSchema } from "./utils";
import { requirePermission } from "@/features/auth/server/utils";
import { logAuditEvent } from "@/lib/security/audit";

import type { CreateRiderActionResult } from "./dto";

function getCreateRiderErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505" &&
    "constraint_name" in error
  ) {
    const constraintName = typeof error.constraint_name === "string" ? error.constraint_name : null;

    if (constraintName === "riders_rider_code_uidx") {
      return "Rider code already exists.";
    }

    if (constraintName === "riders_linked_app_user_uidx") {
      return "Linked app user is already connected to another rider.";
    }

    return "Rider details must be unique.";
  }

  return error instanceof Error ? error.message : "Unable to create rider.";
}

export async function createRiderAction(
  _prevState: CreateRiderActionResult,
  formData: FormData,
): Promise<CreateRiderActionResult> {
  try {
    const currentUser = await requirePermission("rider.create");

    const parsed = createRiderSchema.safeParse({
      riderCode: formData.get("riderCode"),
      fullName: formData.get("fullName"),
      phoneNumber: formData.get("phoneNumber"),
      address: formData.get("address"),
      township: formData.get("township"),
      notes: formData.get("notes"),
      linkedAppUserId: formData.get("linkedAppUserId"),
    });

    if (!parsed.success) {
      return { ok: false, message: "Please provide valid rider details." };
    }

    if (parsed.data.linkedAppUserId) {
      const linkedUser = await findActiveRiderAppUserById(parsed.data.linkedAppUserId);

      if (!linkedUser) {
        return {
          ok: false,
          message: "Linked app user was not found or is not an active rider account.",
        };
      }

      const existingRider = await findRiderByLinkedAppUserId(parsed.data.linkedAppUserId);

      if (existingRider) {
        return { ok: false, message: "Linked app user is already connected to another rider." };
      }
    }

    const created = await createRider({
      riderCode: parsed.data.riderCode,
      fullName: parsed.data.fullName,
      phoneNumber: parsed.data.phoneNumber,
      address: parsed.data.address,
      township: parsed.data.township,
      notes: parsed.data.notes,
      linkedAppUserId: parsed.data.linkedAppUserId,
    });

    await logAuditEvent({
      event: "rider.create",
      actorAppUserId: currentUser.appUserId,
      metadata: {
        riderCode: parsed.data.riderCode,
        linkedAppUser: Boolean(parsed.data.linkedAppUserId),
      },
    });

    revalidatePath("/dashboard/riders");

    return {
      ok: true,
      message: "Rider profile created successfully.",
      riderId: created.id,
    };
  } catch (error) {
    return { ok: false, message: getCreateRiderErrorMessage(error) };
  }
}
