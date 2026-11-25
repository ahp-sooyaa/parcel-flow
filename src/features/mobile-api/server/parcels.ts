import {
  mobileParcelStatuses,
  mobileParcelTypes,
  mobileRiderParcelTabs,
  type MobileMerchantReturnContactDto,
  type MobileRiderParcelDetailDto,
  type MobileRiderParcelListItemDto,
  type MobileRiderParcelPageDto,
} from "@/features/mobile-api/contract";
import {
  riderParcelTabs,
  type ParcelListItemDto,
  type RiderParcelListPageDto,
} from "@/features/parcels/server/dto";
import { calculateAmountToCollect } from "@/features/parcels/server/utils";
import { parcelStatuses, parcelStatusLabels, parcelTypes } from "@/lib/domain";

// The contract spells these lists out (it can't import server code). Checking
// both directions makes the build fail if either side gains or loses a value.
void (mobileParcelStatuses satisfies readonly (typeof parcelStatuses)[number][]);
void (parcelStatuses satisfies readonly (typeof mobileParcelStatuses)[number][]);
void (mobileParcelTypes satisfies readonly (typeof parcelTypes)[number][]);
void (parcelTypes satisfies readonly (typeof mobileParcelTypes)[number][]);
void (mobileRiderParcelTabs satisfies readonly (typeof riderParcelTabs)[number][]);
void (riderParcelTabs satisfies readonly (typeof mobileRiderParcelTabs)[number][]);

// The app scrolls instead of paging, so it asks for more than the web's 12.
export const MOBILE_RIDER_PARCEL_PAGE_SIZE = 20;

export function toMobileRiderParcelListItem(
  parcel: ParcelListItemDto,
): MobileRiderParcelListItemDto {
  return {
    id: parcel.id,
    parcelCode: parcel.parcelCode,
    status: parcel.status,
    statusLabel: parcelStatusLabels[parcel.status],
    merchantName: parcel.merchantName,
    receiverName: parcel.receiverName,
    receiverPhoneNumber: parcel.receiverPhoneNumber,
    receiverAddress: parcel.receiverAddress,
    townshipName: parcel.townshipName,
    amountToCollect: calculateAmountToCollect(parcel),
    hasActiveFailureNote: parcel.activeFailureNote !== null,
  };
}

/** `merchantReturnContact` is only passed for a `canceled_returned` parcel. */
export function toMobileRiderParcelDetail(
  parcel: ParcelListItemDto,
  merchantReturnContact: MobileMerchantReturnContactDto | null = null,
): MobileRiderParcelDetailDto {
  return {
    ...toMobileRiderParcelListItem(parcel),
    parcelType: parcel.parcelType,
    codAmount: parcel.codAmount,
    deliveryFee: parcel.deliveryFee,
    weightKg: parcel.weightKg,
    specialNotes: parcel.specialNotes,
    activeFailureNote: parcel.activeFailureNote?.note ?? null,
    merchantReturnContact,
    createdAt: parcel.createdAt,
  };
}

export function toMobileRiderParcelPage(page: RiderParcelListPageDto): MobileRiderParcelPageDto {
  return {
    parcels: page.parcels.map(toMobileRiderParcelListItem),
    page: page.page,
    totalPages: page.totalPages,
    totalCount: page.totalCount,
    tabCounts: page.tabCounts,
  };
}
