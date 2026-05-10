import type { TownshipListItemDto } from "@/features/townships/server/dto";

const townships: TownshipListItemDto[] = [
  {
    id: "township-1",
    name: "Sanchaung",
    baseFee: 2500,
    baseWeightKg: 3,
    extraWeightFee: 500,
    isActive: true,
  },
  {
    id: "township-2",
    name: "Hlaing",
    baseFee: 3000,
    baseWeightKg: 3,
    extraWeightFee: 500,
    isActive: true,
  },
  {
    id: "township-3",
    name: "Tamwe",
    baseFee: 2500,
    baseWeightKg: 3,
    extraWeightFee: 500,
    isActive: true,
  },
];

export async function listTownships() {
  return townships;
}
