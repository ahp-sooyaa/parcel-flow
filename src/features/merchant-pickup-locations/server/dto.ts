import "server-only";

export type MerchantPickupLocationDto = {
    id: string;
    merchantId: string;
    label: string;
    townshipId: string;
    townshipName: string | null;
    pickupAddress: string;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
};

export function toMerchantPickupLocationDto(
    input: MerchantPickupLocationDto,
): MerchantPickupLocationDto {
    return {
        id: input.id,
        merchantId: input.merchantId,
        label: input.label,
        townshipId: input.townshipId,
        townshipName: input.townshipName,
        pickupAddress: input.pickupAddress,
        isDefault: input.isDefault,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
    };
}
