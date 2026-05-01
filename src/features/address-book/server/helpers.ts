import "server-only";
import { findMerchantProfileLinkByAppUserId } from "@/features/merchant/server/dal";

export async function getMerchantProfileLinkByAppUserIdForAddressBook(merchantId: string) {
    return findMerchantProfileLinkByAppUserId(merchantId);
}
