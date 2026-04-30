import "server-only";

export type AddressBookActionResult = {
    ok: boolean;
    message: string;
    fieldErrors?: Partial<Record<string, string[]>>;
};

export type AddressBookTab = "recipient-contacts" | "pickup-locations";

export type AddressBookPageDataDto = {
    selectedMerchantId: string | null;
    merchants: {
        id: string;
        label: string;
    }[];
    recipientContacts: import("@/features/merchant-contacts/server/dto").MerchantContactManagementDto[];
    pickupLocations: import("@/features/merchant-pickup-locations/server/dto").MerchantPickupLocationDto[];
    townships: {
        id: string;
        label: string;
    }[];
};
