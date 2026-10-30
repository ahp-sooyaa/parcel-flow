import {
  mobileParcelStatuses,
  mobileParcelTypes,
  mobileRiderParcelTabs,
  type MobileRiderParcelDetailDto,
  type MobileRiderParcelListItemDto,
  type MobileRiderParcelPageDto,
} from "@/features/mobile-api/contract";
import {
  riderParcelTabs,
  type ParcelListItemDto,
  type RiderParcelListPageDto,
} from "@/features/parcels/server/dto";
import { parcelStatuses, parcelStatusLabels, parcelTypes } from "@/lib/domain";
import { coerceSqlNumber } from "@/lib/format";

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

/**
 * What the rider collects at the door: COD plus the delivery fee. Same rule as
 * the web rider card (src/features/parcels/components/rider-parcel-card-list.tsx).
 */
export function getAmountToCollect(parcel: Pick<ParcelListItemDto, "codAmount" | "deliveryFee">) {
  return parcel.codAmount + parcel.deliveryFee;
}

export function toMobileRiderParcelListItem(
  parcel: ParcelListItemDto,
): MobileRiderParcelListItemDto {
  return {
    id: parcel.id,
    parcelCode: parcel.parcelCode,
    status: parcel.status,
    statusLabel: parcelStatusLabels[parcel.status],
    receiverName: parcel.receiverName,
    receiverPhoneNumber: parcel.receiverPhoneNumber,
    receiverAddress: parcel.receiverAddress,
    townshipName: parcel.townshipName,
    amountToCollect: getAmountToCollect(parcel),
    hasActiveFailureNote: parcel.activeFailureNote !== null,
  };
}

export function toMobileRiderParcelDetail(parcel: ParcelListItemDto): MobileRiderParcelDetailDto {
  return {
    ...toMobileRiderParcelListItem(parcel),
    merchantName: parcel.merchantName,
    parcelType: parcel.parcelType,
    codAmount: parcel.codAmount,
    deliveryFee: parcel.deliveryFee,
    weightKg: parcel.weightKg,
    specialNotes: parcel.specialNotes,
    activeFailureNote: parcel.activeFailureNote?.note ?? null,
    createdAt: parcel.createdAt,
  };
}

export function toMobileRiderParcelPage(page: RiderParcelListPageDto): MobileRiderParcelPageDto {
  // postgres-js returns `count(*)` (bigint) as a string, although the DAL types
  // its counts as numbers. The mobile contract is strict, so convert here.
  return {
    parcels: page.parcels.map(toMobileRiderParcelListItem),
    page: page.page,
    totalPages: page.totalPages,
    totalCount: coerceSqlNumber(page.totalCount),
    tabCounts: {
      to_deliver: coerceSqlNumber(page.tabCounts.to_deliver),
      delivered: coerceSqlNumber(page.tabCounts.delivered),
      returned: coerceSqlNumber(page.tabCounts.returned),
    },
  };
}
