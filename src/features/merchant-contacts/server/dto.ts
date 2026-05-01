import "server-only";

export type MerchantContactSearchResultDto = {
    id: string;
    merchantId: string;
    contactLabel: string;
    recipientName: string;
    recipientPhone: string;
    recipientTownshipId: string;
    recipientAddress: string;
};

export type MerchantContactOptionDto = {
    id: string;
    label: string;
};

export type MerchantContactManagementDto = {
    id: string;
    merchantId: string;
    merchantLabel?: string | null;
    contactLabel: string;
    recipientName: string;
    recipientPhone: string;
    recipientTownshipId: string;
    recipientTownshipName: string | null;
    recipientAddress: string;
    createdAt: Date;
    updatedAt: Date;
};

export function toMerchantContactSearchResultDto(
    input: MerchantContactSearchResultDto,
): MerchantContactSearchResultDto {
    return {
        id: input.id,
        merchantId: input.merchantId,
        contactLabel: input.contactLabel,
        recipientName: input.recipientName,
        recipientPhone: input.recipientPhone,
        recipientTownshipId: input.recipientTownshipId,
        recipientAddress: input.recipientAddress,
    };
}

export function toMerchantContactOptionDto(
    input: MerchantContactOptionDto,
): MerchantContactOptionDto {
    return {
        id: input.id,
        label: input.label,
    };
}

export function toMerchantContactManagementDto(
    input: MerchantContactManagementDto,
): MerchantContactManagementDto {
    return {
        id: input.id,
        merchantId: input.merchantId,
        merchantLabel: input.merchantLabel,
        contactLabel: input.contactLabel,
        recipientName: input.recipientName,
        recipientPhone: input.recipientPhone,
        recipientTownshipId: input.recipientTownshipId,
        recipientTownshipName: input.recipientTownshipName,
        recipientAddress: input.recipientAddress,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
    };
}
