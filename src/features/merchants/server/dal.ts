import { and, eq, isNull, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/db";
import { appUsers, merchants, merchantSettlements, parcels } from "@/db/schema";
import type {
  MerchantListItemDto,
  MerchantOptionDto,
  MerchantOverviewSummaryDto,
} from "@/features/merchants/server/dto";
import { CACHE_TAGS, merchantOverviewTag } from "@/lib/cache-tags";

async function loadMerchantParcelAggregations() {
  const aggregationRows = await db
    .select({
      merchantId: parcels.merchantId,
      parcelCount: sql<number>`count(*)`.mapWith(Number),
      pendingPayment: sql<number>`coalesce(sum(
        case when ${parcels.status} = 'delivered' then ${parcels.codAmount} - ${parcels.deliveryFee} else 0 end
      ), 0)`.mapWith(Number),
    })
    .from(parcels)
    .where(isNull(parcels.deletedAt))
    .groupBy(parcels.merchantId);

  return new Map(
    aggregationRows.map((row) => [
      row.merchantId,
      {
        parcelCount: row.parcelCount,
        pendingPayment: row.pendingPayment,
      },
    ]),
  );
}

export async function listMerchants(): Promise<MerchantListItemDto[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.merchants, CACHE_TAGS.parcels);

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

  const aggregationsByMerchantId = await loadMerchantParcelAggregations();

  return rows.map((merchant) => {
    const aggregation = aggregationsByMerchantId.get(merchant.id);

    return {
      ...merchant,
      pendingPayment: aggregation?.pendingPayment ?? 0,
      parcelCount: aggregation?.parcelCount ?? 0,
    };
  });
}

export async function listMerchantOptions(): Promise<MerchantOptionDto[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.merchantOptions, CACHE_TAGS.merchants);

  return db
    .select({
      id: merchants.id,
      shopName: merchants.shopName,
      ownerName: appUsers.name,
      phoneNumber: appUsers.phoneNumber,
    })
    .from(merchants)
    .innerJoin(appUsers, eq(appUsers.id, merchants.userId))
    .where(isNull(appUsers.deletedAt));
}

export async function getMerchantOverviewSummary(
  merchantUserId: string,
): Promise<MerchantOverviewSummaryDto> {
  "use cache";
  cacheLife("minutes");
  cacheTag(merchantOverviewTag(merchantUserId), CACHE_TAGS.parcels, CACHE_TAGS.settlements);

  const [parcelSummaryRow, settledSettlementRows] = await Promise.all([
    db
      .select({
        totalParcels: sql<number>`count(*)`.mapWith(Number),
        onTheWayParcels:
          sql<number>`count(*) filter (where ${parcels.status} = 'on_the_way')`.mapWith(Number),
        deliveredParcels:
          sql<number>`count(*) filter (where ${parcels.status} = 'delivered')`.mapWith(Number),
        totalCodCollected: sql<number>`coalesce(sum(
          case
            when ${parcels.status} = 'delivered'
              and ${parcels.parcelType} = 'cod'
              and ${parcels.isReceivedByOffice}
            then ${parcels.codAmount}
            else 0
          end
        ), 0)`.mapWith(Number),
      })
      .from(parcels)
      .innerJoin(merchants, eq(merchants.id, parcels.merchantId))
      .where(and(isNull(parcels.deletedAt), eq(merchants.userId, merchantUserId)))
      .then((rows) => rows[0]),
    db
      .select({
        netPaymentAmount: merchantSettlements.netPaymentAmount,
      })
      .from(merchantSettlements)
      .innerJoin(merchants, eq(merchants.id, merchantSettlements.merchantId))
      .where(and(eq(merchants.userId, merchantUserId), eq(merchantSettlements.status, "settled"))),
  ]);

  return {
    totalCodCollected: parcelSummaryRow?.totalCodCollected ?? 0,
    paidToYou: settledSettlementRows.reduce(
      (total, settlement) => total + settlement.netPaymentAmount,
      0,
    ),
    totalParcels: parcelSummaryRow?.totalParcels ?? 0,
    onTheWayParcels: parcelSummaryRow?.onTheWayParcels ?? 0,
    deliveredParcels: parcelSummaryRow?.deliveredParcels ?? 0,
  };
}
