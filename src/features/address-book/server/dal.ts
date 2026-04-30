import "server-only";
import { getMerchantProfileLinkByAppUserIdForAddressBook } from "@/features/address-book/server/helpers";
import { getAddressBookAccess } from "@/features/auth/server/policies/address-book";
import { listMerchantContactsForManagement } from "@/features/merchant-contacts/server/dal";
import { listMerchantPickupLocations } from "@/features/merchant-pickup-locations/server/dal";
import { getMerchantsListForViewer } from "@/features/merchant/server/dal";
import { getTownshipOptions } from "@/features/townships/server/dal";

import type { AddressBookPageDataDto } from "@/features/address-book/server/dto";
import type { AppAccessContext } from "@/features/auth/server/dto";

export async function getAddressBookPageData(
    viewer: AppAccessContext,
    input: {
        merchantId?: string | null;
        query?: string;
    },
): Promise<AddressBookPageDataDto> {
    const access = getAddressBookAccess({ viewer });
    const merchants = access.canSelectMerchant
        ? (await getMerchantsListForViewer(viewer, { limit: 200 })).map((merchant) => ({
              id: merchant.id,
              label: merchant.shopName,
          }))
        : [];
    const selectedMerchantId =
        viewer.roleSlug === "merchant"
            ? viewer.appUserId
            : input.merchantId &&
                (await getMerchantProfileLinkByAppUserIdForAddressBook(input.merchantId))
              ? input.merchantId
              : null;

    const [townships, recipientContacts, pickupLocations] = selectedMerchantId
        ? await Promise.all([
              getTownshipOptions(),
              listMerchantContactsForManagement({
                  merchantId: selectedMerchantId,
                  query: input.query,
              }),
              listMerchantPickupLocations({ merchantId: selectedMerchantId }),
          ])
        : [[], [], []];

    return {
        selectedMerchantId,
        merchants,
        recipientContacts,
        pickupLocations,
        townships: townships.map((township) => ({ id: township.id, label: township.name })),
    };
}
