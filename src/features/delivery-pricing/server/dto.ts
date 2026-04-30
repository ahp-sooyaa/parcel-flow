import "server-only";

export type DeliveryPricingRateDto = {
    id: string;
    townshipId: string;
    townshipName: string;
    merchantId: string | null;
    merchantLabel: string | null;
    scope: "global" | "merchant_specific";
    baseWeightKg: string;
    baseFee: string;
    extraWeightUnitKg: string;
    extraWeightFee: string;
    volumetricDivisor: number;
    codFeePercent: string;
    returnFeePercent: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
};

export type DeliveryPricingOptionDto = {
    id: string;
    label: string;
};

export type DeliveryPricingQuoteDto = {
    rateId: string;
    rateScope: "global" | "merchant_specific";
    deliveryFee: string;
    chargeableWeightKg: string;
    volumetricWeightKg: string | null;
    codFeePercent: string;
    returnFeePercent: string;
};

export type DeliveryPricingRateActionResult = {
    ok: boolean;
    message: string;
    rateId?: string;
    fieldErrors?: Partial<Record<string, string[]>>;
};

export type DeliveryPricingQuoteActionResult =
    | ({
          ok: true;
      } & DeliveryPricingQuoteDto)
    | {
          ok: false;
          message: string;
      };

export function toDeliveryPricingRateDto(input: DeliveryPricingRateDto): DeliveryPricingRateDto {
    return {
        id: input.id,
        townshipId: input.townshipId,
        townshipName: input.townshipName,
        merchantId: input.merchantId,
        merchantLabel: input.merchantLabel,
        scope: input.scope,
        baseWeightKg: input.baseWeightKg,
        baseFee: input.baseFee,
        extraWeightUnitKg: input.extraWeightUnitKg,
        extraWeightFee: input.extraWeightFee,
        volumetricDivisor: input.volumetricDivisor,
        codFeePercent: input.codFeePercent,
        returnFeePercent: input.returnFeePercent,
        isActive: input.isActive,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
    };
}

export function toDeliveryPricingOptionDto(
    input: DeliveryPricingOptionDto,
): DeliveryPricingOptionDto {
    return {
        id: input.id,
        label: input.label,
    };
}

export function toDeliveryPricingQuoteDto(input: DeliveryPricingQuoteDto): DeliveryPricingQuoteDto {
    return {
        rateId: input.rateId,
        rateScope: input.rateScope,
        deliveryFee: input.deliveryFee,
        chargeableWeightKg: input.chargeableWeightKg,
        volumetricWeightKg: input.volumetricWeightKg,
        codFeePercent: input.codFeePercent,
        returnFeePercent: input.returnFeePercent,
    };
}
