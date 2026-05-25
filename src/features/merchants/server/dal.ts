import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { appUsers, merchants, merchantSettlements, parcels } from "@/db/schema";
import type {
  MerchantListItemDto,
  MerchantOverviewSummaryDto,
} from "@/features/merchants/server/dto";

export async function listMerchants(): Promise<MerchantListItemDto[]> {
  const rows = await db
    .select({
      id: merchants.id,
      shopName: merchants.shopName,
      ownerName: appUsers.name,
      phoneNumber: appUsers.phoneNumber,
      address: merchants.address,
    })
    .from(merchants)
    .innerJoin(appUsers, eq(appUsers.id, merchants.userId))
    .where(isNull(appUsers.deletedAt));

  const parcelRows = await db
    .select({
      merchantId: parcels.merchantId,
      codAmount: parcels.codAmount,
      deliveryFee: parcels.deliveryFee,
      status: parcels.status,
    })
    .from(parcels)
    .where(isNull(parcels.deletedAt));

  return rows.map((merchant) => {
    const merchantParcels = parcelRows.filter((parcel) => parcel.merchantId === merchant.id);

    return {
      ...merchant,
      pendingPayment: merchantParcels
        .filter((parcel) => parcel.status === "delivered")
        .reduce((total, parcel) => total + parcel.codAmount - parcel.deliveryFee, 0),
      parcelCount: merchantParcels.length,
    };
  });
}

export async function getMerchantOverviewSummary(
  merchantUserId: string,
): Promise<MerchantOverviewSummaryDto> {
  const [parcelRows, settledSettlementRows] = await Promise.all([
    db
      .select({
        status: parcels.status,
        parcelType: parcels.parcelType,
        codAmount: parcels.codAmount,
        isReceivedByOffice: parcels.isReceivedByOffice,
      })
      .from(parcels)
      .innerJoin(merchants, eq(merchants.id, parcels.merchantId))
      .where(and(isNull(parcels.deletedAt), eq(merchants.userId, merchantUserId))),
    db
      .select({
        netPaymentAmount: merchantSettlements.netPaymentAmount,
      })
      .from(merchantSettlements)
      .innerJoin(merchants, eq(merchants.id, merchantSettlements.merchantId))
      .where(and(eq(merchants.userId, merchantUserId), eq(merchantSettlements.status, "settled"))),
  ]);

  return parcelRows.reduce<MerchantOverviewSummaryDto>(
    (summary, parcel) => ({
      totalCodCollected:
        summary.totalCodCollected +
        (parcel.status === "delivered" && parcel.parcelType === "cod" && parcel.isReceivedByOffice
          ? parcel.codAmount
          : 0),
      paidToYou: summary.paidToYou,
      totalParcels: summary.totalParcels + 1,
      onTheWayParcels: summary.onTheWayParcels + (parcel.status === "on_the_way" ? 1 : 0),
      deliveredParcels: summary.deliveredParcels + (parcel.status === "delivered" ? 1 : 0),
    }),
    {
      totalCodCollected: 0,
      paidToYou: settledSettlementRows.reduce(
        (total, settlement) => total + settlement.netPaymentAmount,
        0,
      ),
      totalParcels: 0,
      onTheWayParcels: 0,
      deliveredParcels: 0,
    },
  );
}
