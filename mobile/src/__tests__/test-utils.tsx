import type {
  MobileRiderParcelDetailDto,
  MobileRiderParcelListItemDto,
} from "@parcel-flow/contract";
import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react-native";
import type { ReactElement } from "react";

import { queryClient } from "@/api/query-client";

/** Renders with the app's shared QueryClient, which screens read from directly. */
export function renderWithQueryClient(element: ReactElement) {
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}

export function buildListItem(
  overrides: Partial<MobileRiderParcelListItemDto> = {},
): MobileRiderParcelListItemDto {
  return {
    id: "0f7a3c2e-2222-4b1c-8d9e-000000000001",
    parcelCode: "PF-000123-000045",
    status: "on_the_way",
    statusLabel: "On The Way",
    receiverName: "Daw Mya",
    receiverPhoneNumber: "09400000000",
    receiverAddress: "No. 12, Bogyoke Road",
    townshipName: "Sanchaung",
    amountToCollect: 28_000,
    hasActiveFailureNote: false,
    ...overrides,
  };
}

export function buildDetail(
  overrides: Partial<MobileRiderParcelDetailDto> = {},
): MobileRiderParcelDetailDto {
  return {
    ...buildListItem(),
    merchantName: "Golden Leaf Tea",
    parcelType: "cod",
    codAmount: 25_000,
    deliveryFee: 3_000,
    weightKg: 1.5,
    specialNotes: null,
    activeFailureNote: null,
    createdAt: "2026-10-29T08:00:00.000Z",
    ...overrides,
  };
}
