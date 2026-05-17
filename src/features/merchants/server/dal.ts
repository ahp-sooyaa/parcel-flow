import { eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { appUsers, merchants, parcels } from "@/db/schema";
import type { MerchantListItemDto } from "@/features/merchants/server/dto";

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
