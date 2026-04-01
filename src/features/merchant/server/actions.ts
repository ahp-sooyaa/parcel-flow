"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createMerchant, findMerchantByLinkedAppUserId } from "./dal";
import { createMerchantSchema } from "./utils";
import { findAppUserById } from "@/features/auth/server/dal";
import { requirePermission } from "@/features/auth/server/utils";
import { logAuditEvent } from "@/lib/security/audit";

import type { CreateMerchantActionResult } from "./dto";

export async function createMerchantAction(
  _prevState: CreateMerchantActionResult,
  formData: FormData,
): Promise<CreateMerchantActionResult> {
  try {
    const currentUser = await requirePermission("merchant.create");

    const parsed = createMerchantSchema.safeParse({
      name: formData.get("name"),
      phoneNumber: formData.get("phoneNumber"),
      address: formData.get("address"),
      township: formData.get("township"),
      notes: formData.get("notes"),
      linkedAppUserId: formData.get("linkedAppUserId"),
    });

    if (!parsed.success) {
      return { ok: false, message: "Please provide valid merchant details." };
    }

    if (parsed.data.linkedAppUserId) {
      const linkedUser = await findAppUserById(parsed.data.linkedAppUserId);

      if (!linkedUser) {
        return { ok: false, message: "Linked app user was not found." };
      }

      const existingMerchant = await findMerchantByLinkedAppUserId(parsed.data.linkedAppUserId);

      if (existingMerchant) {
        return { ok: false, message: "Linked app user is already connected to another merchant." };
      }
    }

    const created = await createMerchant({
      name: parsed.data.name,
      phoneNumber: parsed.data.phoneNumber,
      address: parsed.data.address,
      township: parsed.data.township,
      notes: parsed.data.notes,
      linkedAppUserId: parsed.data.linkedAppUserId,
    });

    await logAuditEvent({
      event: "merchant.create",
      actorAppUserId: currentUser.appUserId,
      metadata: {
        linkedAppUser: Boolean(parsed.data.linkedAppUserId),
      },
    });

    revalidatePath("/dashboard/merchants");

    return {
      ok: true,
      message: "Merchant profile created successfully.",
      merchantId: created.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create merchant.";

    return { ok: false, message };
  }
}
