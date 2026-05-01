"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { updateMerchantProfileSchema } from "./utils";
import { getMerchantAccess } from "@/features/auth/server/policies/merchant";
import { requireAppAccessContext } from "@/features/auth/server/utils";
import { updateMerchantProfile } from "@/features/merchant/server/dal";
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

        const merchantAccess = getMerchantAccess({
            viewer: currentUser,
            merchantAppUserId: parsed.data.merchantId,
        });

        if (!merchantAccess.canUpdate) {
            return { ok: false, message: "Forbidden" };
        }

        await updateMerchantProfile({
            merchantId: parsed.data.merchantId,
            shopName: parsed.data.shopName,
            notes: parsed.data.notes,
        });

        await logAuditEvent({
            event: "merchant.update",
            actorAppUserId: currentUser.appUserId,
            targetAppUserId: parsed.data.merchantId,
            metadata: undefined,
        });

        revalidatePath(`/dashboard/merchants/${parsed.data.merchantId}`);
        revalidatePath("/dashboard/merchants");
        revalidatePath("/dashboard/settings");
        revalidatePath(`/dashboard/users/${parsed.data.merchantId}`);
        revalidatePath(`/dashboard/users/${parsed.data.merchantId}/edit`);

        return { ok: true, message: "Merchant profile updated." };
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to update merchant profile.";

        return { ok: false, message };
    }
}
