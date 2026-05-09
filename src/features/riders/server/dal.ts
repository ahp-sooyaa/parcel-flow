import type { RiderListItemDto } from "@/features/riders/server/dto";

const riders: RiderListItemDto[] = [
  {
    id: "rider-1",
    name: "Ko Min",
    phoneNumber: "09700001111",
    serviceTownships: ["Sanchaung", "Hlaing"],
    expectedCollection: 87500,
    actualCollection: 230000,
    activeParcelCount: 7,
  },
  {
    id: "rider-2",
    name: "Ma Ei",
    phoneNumber: "09700002222",
    serviceTownships: ["Tamwe", "Bahan"],
    expectedCollection: 0,
    actualCollection: 44500,
    activeParcelCount: 0,
  },
];

export async function listRiders() {
  return riders;
}
