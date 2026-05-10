import type { ParcelStatus } from "@/lib/domain";

export type ParcelListItemDto = {
  id: string;
  parcelCode: string;
  merchantName: string;
  receiverName: string;
  receiverPhoneNumber: string;
  receiverAddress: string;
  specialNotes: string | null;
  townshipName: string;
  codAmount: number;
  deliveryFee: number;
  riderName: string | null;
  status: ParcelStatus;
  createdAt: string;
};

export type ParcelSummaryDto = {
  totalParcels: number;
  atOffice: number;
  onTheWay: number;
  delivered: number;
  expectedCollection: number;
};
