import type { ParcelListItemDto, ParcelSummaryDto } from "@/features/parcels/server/dto";
import { calculateAmountToCollect, isActiveCollectionStatus } from "@/features/parcels/server/utils";

const parcels: ParcelListItemDto[] = [
  {
    id: "parcel-1",
    parcelCode: "PF-483921-740268",
    merchantName: "North Star Mart",
    receiverName: "Aye Chan",
    receiverPhoneNumber: "09777111222",
    receiverAddress: "12 Mingalar Street, Myaynigone Ward, near the city mart",
    specialNotes: "Call before arrival. Receiver may ask security to collect first.",
    townshipName: "Sanchaung",
    codAmount: 85000,
    deliveryFee: 2500,
    riderName: "Ko Min",
    status: "on_the_way",
    createdAt: "2026-05-09",
  },
  {
    id: "parcel-2",
    parcelCode: "PF-193840-382019",
    merchantName: "Ruby Home Store",
    receiverName: "May Thu",
    receiverPhoneNumber: "09999123456",
    receiverAddress: "Room 4B, Pyay Road housing, beside the tea shop",
    specialNotes: null,
    townshipName: "Hlaing",
    codAmount: 0,
    deliveryFee: 3000,
    riderName: null,
    status: "at_office",
    createdAt: "2026-05-09",
  },
  {
    id: "parcel-3",
    parcelCode: "PF-284001-992014",
    merchantName: "Mango Threads",
    receiverName: "Thura",
    receiverPhoneNumber: "09700001888",
    receiverAddress: "48 Upper Pazundaung Road, third floor, left unit",
    specialNotes: "Leave at reception if the phone is unreachable.",
    townshipName: "Tamwe",
    codAmount: 42000,
    deliveryFee: 2500,
    riderName: "Ma Ei",
    status: "delivered",
    createdAt: "2026-05-08",
  },
];

export async function listParcels(): Promise<ParcelListItemDto[]> {
  return parcels;
}

export async function getParcelSummary(): Promise<ParcelSummaryDto> {
  return parcels.reduce<ParcelSummaryDto>(
    (summary, parcel) => {
      const amountToCollect = calculateAmountToCollect({
        codAmount: parcel.codAmount,
        deliveryFee: parcel.deliveryFee,
        parcelType: parcel.codAmount > 0 ? "cod" : "non_cod",
      });

      return {
        totalParcels: summary.totalParcels + 1,
        atOffice: summary.atOffice + (parcel.status === "at_office" ? 1 : 0),
        onTheWay: summary.onTheWay + (parcel.status === "on_the_way" ? 1 : 0),
        delivered: summary.delivered + (parcel.status === "delivered" ? 1 : 0),
        expectedCollection:
          summary.expectedCollection + (isActiveCollectionStatus(parcel.status) ? amountToCollect : 0),
      };
    },
    {
      totalParcels: 0,
      atOffice: 0,
      onTheWay: 0,
      delivered: 0,
      expectedCollection: 0,
    },
  );
}
