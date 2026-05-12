export type TownshipListItemDto = {
  id: string;
  name: string;
  baseFee: number;
  baseWeightKg: number;
  extraWeightFee: number;
  extraWeightUnitKg: number;
  volumetricDivisor: number;
  codFeePercent: number;
  returnFeePercent: number;
  isActive: boolean;
};
