import { describe, expect, it } from "vitest";
import {
    calculateDeliveryFeeFromRate,
    calculateVolumetricWeightKg,
    resolveChargeableWeightKg,
} from "../../src/features/delivery-pricing/server/utils";

describe("delivery pricing helpers", () => {
    it("uses actual weight only for standard parcels", () => {
        expect(
            resolveChargeableWeightKg({
                estimatedWeightKg: 1.25,
                isLargeItem: false,
                packageWidthCm: 50,
                packageHeightCm: 50,
                packageLengthCm: 50,
                volumetricDivisor: 5000,
            }),
        ).toEqual({
            chargeableWeightKg: 1.25,
            volumetricWeightKg: null,
        });
    });

    it("uses the larger of actual and volumetric weight for large parcels", () => {
        expect(
            resolveChargeableWeightKg({
                estimatedWeightKg: 2,
                isLargeItem: true,
                packageWidthCm: 50,
                packageHeightCm: 40,
                packageLengthCm: 60,
                volumetricDivisor: 5000,
            }),
        ).toEqual({
            chargeableWeightKg: 24,
            volumetricWeightKg: 24,
        });
    });

    it("calculates volumetric weight from dimensions and divisor", () => {
        expect(
            calculateVolumetricWeightKg({
                lengthCm: 40,
                widthCm: 30,
                heightCm: 20,
                volumetricDivisor: 5000,
            }),
        ).toBe(4.8);
    });

    it("returns the base fee when chargeable weight is within the base threshold", () => {
        expect(
            calculateDeliveryFeeFromRate({
                chargeableWeightKg: 1,
                baseWeightKg: 1,
                baseFee: 2500,
                extraWeightUnitKg: 0.5,
                extraWeightFee: 500,
            }),
        ).toBe(2500);
    });

    it("rounds extra weight units up when calculating the delivery fee", () => {
        expect(
            calculateDeliveryFeeFromRate({
                chargeableWeightKg: 1.6,
                baseWeightKg: 1,
                baseFee: 2500,
                extraWeightUnitKg: 0.5,
                extraWeightFee: 500,
            }),
        ).toBe(3500);
    });
});
