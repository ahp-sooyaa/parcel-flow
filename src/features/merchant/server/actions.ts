"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { getMerchantResourceAccess, updateMerchantProfileSchema } from "./utils";
import { requireAppAccessContext } from "@/features/auth/server/utils";
import { updateMerchantProfile } from "@/features/merchant/server/dal";
import { findTownshipById } from "@/features/townships/server/dal";
import { logAuditEvent } from "@/lib/security/audit";

export type UpdateMerchantProfileActionResult = {
  ok: boolean;
  message: string;
};

export async function updateMerchantProfileAction(
  _prevState: UpdateMerchantProfileActionResult,
  formData: FormData,
): Promise<UpdateMerchantProfileActionResult> {
  try {
    const currentUser = await requireAppAccessContext();

    const parsed = updateMerchantProfileSchema.safeParse(Object.fromEntries(formData));

    if (!parsed.success) {
      return { ok: false, message: "Please provide valid merchant profile data." };
    }

    const merchantAccess = getMerchantResourceAccess({
      viewer: currentUser,
      merchantAppUserId: parsed.data.merchantId,
    });

    if (!merchantAccess.canUpdate) {
      return { ok: false, message: "Forbidden" };
    }

    if (parsed.data.pickupTownshipId) {
      const township = await findTownshipById(parsed.data.pickupTownshipId);

      if (!township?.isActive) {
        return { ok: false, message: "Selected township was not found." };
      }
    }

    await updateMerchantProfile({
      merchantId: parsed.data.merchantId,
      shopName: parsed.data.shopName,
      pickupTownshipId: parsed.data.pickupTownshipId,
      defaultPickupAddress: parsed.data.defaultPickupAddress,
      notes: parsed.data.notes,
    });

    await logAuditEvent({
      event: "merchant.update",
      actorAppUserId: currentUser.appUserId,
      targetAppUserId: parsed.data.merchantId,
      metadata: {
        pickupTownshipId: parsed.data.pickupTownshipId,
      },
    });

    revalidatePath(`/dashboard/merchants/${parsed.data.merchantId}`);
    revalidatePath("/dashboard/merchants");
    revalidatePath("/dashboard/profile");
    revalidatePath(`/dashboard/users/${parsed.data.merchantId}`);
    revalidatePath(`/dashboard/users/${parsed.data.merchantId}/edit`);

    return { ok: true, message: "Merchant profile updated." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update merchant profile.";

    return { ok: false, message };
  }
}
