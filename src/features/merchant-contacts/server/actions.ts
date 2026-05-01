"use server";

import "server-only";
import { searchMerchantContacts } from "./dal";
import { merchantContactSearchSchema } from "./utils";
import { requireAppAccessContext } from "@/features/auth/server/utils";
import { findMerchantProfileLinkByAppUserId } from "@/features/merchant/server/dal";

export async function searchMerchantContactsAction(input: { merchantId: string; query: string }) {
    try {
        const currentUser = await requireAppAccessContext();

        if (currentUser.roleSlug === "rider") {
            return [];
        }

        if (currentUser.roleSlug === "merchant" && currentUser.appUserId !== input.merchantId) {
            return [];
        }

        const parsed = merchantContactSearchSchema.safeParse(input);

        if (!parsed.success) {
            return [];
        }

        const merchant = await findMerchantProfileLinkByAppUserId(parsed.data.merchantId);

        if (!merchant) {
            return [];
        }

        return searchMerchantContacts(parsed.data);
    } catch {
        return [];
    }
}
