"use server";

import "server-only";
import { requireAppAccessContext } from "@/features/auth/server/utils";
import { searchMerchantPickupLocations } from "@/features/merchant-pickup-locations/server/dal";
import { merchantPickupLocationSearchSchema } from "@/features/merchant-pickup-locations/server/utils";
import { findMerchantProfileLinkByAppUserId } from "@/features/merchant/server/dal";

export async function searchMerchantPickupLocationsAction(input: {
    merchantId: string;
    query: string;
}) {
    try {
        const currentUser = await requireAppAccessContext();

        if (currentUser.roleSlug === "rider") {
            return [];
        }

        if (currentUser.roleSlug === "merchant" && currentUser.appUserId !== input.merchantId) {
            return [];
        }

        const parsed = merchantPickupLocationSearchSchema.safeParse(input);

        if (!parsed.success) {
            return [];
        }

        const merchant = await findMerchantProfileLinkByAppUserId(parsed.data.merchantId);

        if (!merchant) {
            return [];
        }

        return searchMerchantPickupLocations(parsed.data);
    } catch {
        return [];
    }
}
