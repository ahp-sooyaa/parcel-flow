import "server-only";
import { z } from "zod";

export const checkboxBoolean = z.preprocess(
    (value) => value === "on" || value === "true" || value === true,
    z.boolean(),
);

const positiveDecimalField = z.preprocess((value) => {
    if (typeof value === "number") {
        return value;
    }

    if (typeof value !== "string") {
        return Number.NaN;
    }

    const normalized = value.trim();

    if (!normalized) {
        return Number.NaN;
    }

    return Number(normalized);
}, z.number().finite().gt(0).max(999999999));

const nonNegativeDecimalField = z.preprocess((value) => {
    if (typeof value === "number") {
        return value;
    }

    if (typeof value !== "string") {
        return Number.NaN;
    }

    const normalized = value.trim();

    if (!normalized) {
        return Number.NaN;
    }

    return Number(normalized);
}, z.number().finite().min(0).max(999999999));

const positiveIntegerField = z.preprocess((value) => {
    if (typeof value === "number") {
        return value;
    }

    if (typeof value !== "string") {
        return Number.NaN;
    }

    const normalized = value.trim();

    if (!normalized) {
        return Number.NaN;
    }

    return Number(normalized);
}, z.number().int().gt(0).max(999999999));

const optionalNullableUuidField = z
    .preprocess((value) => {
        if (typeof value !== "string") {
            return value;
        }

        const normalized = value.trim();

        return normalized || undefined;
    }, z.string().trim().uuid().optional())
    .transform((value) => value ?? null);

const optionalDecimalField = z
    .preprocess((value) => {
        if (typeof value === "number") {
            return value;
        }

        if (typeof value !== "string") {
            return undefined;
        }

        const normalized = value.trim();

        if (!normalized) {
            return undefined;
        }

        return Number(normalized);
    }, z.number().finite().gt(0).max(999999999).optional())
    .transform((value) => value ?? null);

export const deliveryPricingRateSchema = z.object({
    townshipId: z.string().trim().uuid(),
    merchantId: optionalNullableUuidField,
    baseWeightKg: positiveDecimalField,
    baseFee: nonNegativeDecimalField,
    extraWeightUnitKg: positiveDecimalField,
    extraWeightFee: nonNegativeDecimalField,
    volumetricDivisor: positiveIntegerField,
    codFeePercent: nonNegativeDecimalField,
    returnFeePercent: nonNegativeDecimalField,
    isActive: checkboxBoolean,
});

export const updateDeliveryPricingRateSchema = deliveryPricingRateSchema.extend({
    rateId: z.string().trim().uuid(),
});

export const deactivateDeliveryPricingRateSchema = z.object({
    rateId: z.string().trim().uuid(),
});

export const deliveryPricingQuoteSchema = z.object({
    merchantId: z.string().trim().uuid(),
    recipientTownshipId: z.string().trim().uuid(),
    estimatedWeightKg: positiveDecimalField,
    isLargeItem: checkboxBoolean,
    packageWidthCm: optionalDecimalField,
    packageHeightCm: optionalDecimalField,
    packageLengthCm: optionalDecimalField,
});

export type DeliveryPricingRateInput = z.infer<typeof deliveryPricingRateSchema>;
export type UpdateDeliveryPricingRateInput = z.infer<typeof updateDeliveryPricingRateSchema>;
export type DeliveryPricingQuoteInput = z.infer<typeof deliveryPricingQuoteSchema>;

export function toMoneyString(value: number) {
    return value.toFixed(2);
}

export function calculateVolumetricWeightKg(input: {
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    volumetricDivisor: number;
}) {
    return (input.lengthCm * input.widthCm * input.heightCm) / input.volumetricDivisor;
}

export function resolveChargeableWeightKg(input: {
    estimatedWeightKg: number;
    isLargeItem: boolean;
    packageWidthCm: number | null;
    packageHeightCm: number | null;
    packageLengthCm: number | null;
    volumetricDivisor: number;
}) {
    if (
        !input.isLargeItem ||
        input.packageWidthCm === null ||
        input.packageHeightCm === null ||
        input.packageLengthCm === null
    ) {
        return {
            chargeableWeightKg: input.estimatedWeightKg,
            volumetricWeightKg: null,
        };
    }

    const volumetricWeightKg = calculateVolumetricWeightKg({
        lengthCm: input.packageLengthCm,
        widthCm: input.packageWidthCm,
        heightCm: input.packageHeightCm,
        volumetricDivisor: input.volumetricDivisor,
    });

    return {
        chargeableWeightKg: Math.max(input.estimatedWeightKg, volumetricWeightKg),
        volumetricWeightKg,
    };
}

export function calculateDeliveryFeeFromRate(input: {
    chargeableWeightKg: number;
    baseWeightKg: number;
    baseFee: number;
    extraWeightUnitKg: number;
    extraWeightFee: number;
}) {
    if (input.chargeableWeightKg <= input.baseWeightKg) {
        return input.baseFee;
    }

    const extraWeightKg = input.chargeableWeightKg - input.baseWeightKg;
    const extraUnitCount = Math.ceil(extraWeightKg / input.extraWeightUnitKg);

    return input.baseFee + extraUnitCount * input.extraWeightFee;
}
