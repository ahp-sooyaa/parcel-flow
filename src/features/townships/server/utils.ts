export function calculateDeliveryFee(
  baseFee: number,
  weightKg: number,
  baseWeightKg: number,
  extraWeightFee: number,
) {
  if (weightKg <= baseWeightKg) {
    return baseFee;
  }

  return baseFee + Math.ceil(weightKg - baseWeightKg) * extraWeightFee;
}
