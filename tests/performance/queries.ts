import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { appUsers, financialItems, merchants, parcels, riders, townships } from "@/db/schema";
import type { MerchantParcelListFiltersDto } from "@/features/parcels/server/dto";

export function buildAdminListParcelsQuery() {
  return db
    .select({
      id: parcels.id,
      parcelCode: parcels.parcelCode,
      merchantId: parcels.merchantId,
      merchantName: merchants.shopName,
      receiverName: parcels.receiverName,
      receiverPhoneNumber: parcels.receiverPhoneNumber,
      receiverAddress: parcels.receiverAddress,
      specialNotes: parcels.specialNotes,
      deliveryFailureNote: parcels.deliveryFailureNote,
      townshipId: parcels.townshipId,
      townshipName: townships.name,
      parcelType: parcels.parcelType,
      codAmount: parcels.codAmount,
      deliveryFee: parcels.deliveryFee,
      weightKg: parcels.weightKg,
      parcelWidthCm: parcels.parcelWidthCm,
      parcelHeightCm: parcels.parcelHeightCm,
      parcelLengthCm: parcels.parcelLengthCm,
      proofOfDeliveryImagesKeys: parcels.proofOfDeliveryImagesKeys,
      riderId: parcels.riderId,
      riderName: appUsers.name,
      status: parcels.status,
      createdAt: parcels.createdAt,
    })
    .from(parcels)
    .innerJoin(merchants, eq(merchants.id, parcels.merchantId))
    .innerJoin(townships, eq(townships.id, parcels.townshipId))
    .leftJoin(riders, eq(riders.id, parcels.riderId))
    .leftJoin(appUsers, eq(appUsers.id, riders.userId))
    .where(isNull(parcels.deletedAt));
}

export function buildMerchantParcelsPageQuery(
  userId: string,
  filters: MerchantParcelListFiltersDto,
) {
  const filteredWhere = and(isNull(parcels.deletedAt), eq(merchants.userId, userId));

  return db
    .select({
      id: parcels.id,
      parcelCode: parcels.parcelCode,
      merchantId: parcels.merchantId,
      merchantName: merchants.shopName,
      receiverName: parcels.receiverName,
      receiverPhoneNumber: parcels.receiverPhoneNumber,
      receiverAddress: parcels.receiverAddress,
      specialNotes: parcels.specialNotes,
      deliveryFailureNote: parcels.deliveryFailureNote,
      townshipId: parcels.townshipId,
      townshipName: townships.name,
      parcelType: parcels.parcelType,
      codAmount: parcels.codAmount,
      deliveryFee: parcels.deliveryFee,
      weightKg: parcels.weightKg,
      parcelWidthCm: parcels.parcelWidthCm,
      parcelHeightCm: parcels.parcelHeightCm,
      parcelLengthCm: parcels.parcelLengthCm,
      proofOfDeliveryImagesKeys: parcels.proofOfDeliveryImagesKeys,
      riderId: parcels.riderId,
      riderName: appUsers.name,
      status: parcels.status,
      createdAt: parcels.createdAt,
    })
    .from(parcels)
    .innerJoin(merchants, eq(merchants.id, parcels.merchantId))
    .innerJoin(townships, eq(townships.id, parcels.townshipId))
    .leftJoin(riders, eq(riders.id, parcels.riderId))
    .leftJoin(appUsers, eq(appUsers.id, riders.userId))
    .where(filteredWhere)
    .orderBy(desc(parcels.createdAt), desc(parcels.parcelCode))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);
}

export function buildRiderScopedParcelsQuery(riderUserId: string) {
  return db
    .select({
      id: parcels.id,
      parcelCode: parcels.parcelCode,
      merchantId: parcels.merchantId,
      merchantName: merchants.shopName,
      receiverName: parcels.receiverName,
      receiverPhoneNumber: parcels.receiverPhoneNumber,
      receiverAddress: parcels.receiverAddress,
      specialNotes: parcels.specialNotes,
      deliveryFailureNote: parcels.deliveryFailureNote,
      townshipId: parcels.townshipId,
      townshipName: townships.name,
      parcelType: parcels.parcelType,
      codAmount: parcels.codAmount,
      deliveryFee: parcels.deliveryFee,
      weightKg: parcels.weightKg,
      parcelWidthCm: parcels.parcelWidthCm,
      parcelHeightCm: parcels.parcelHeightCm,
      parcelLengthCm: parcels.parcelLengthCm,
      proofOfDeliveryImagesKeys: parcels.proofOfDeliveryImagesKeys,
      riderId: parcels.riderId,
      riderName: appUsers.name,
      status: parcels.status,
      createdAt: parcels.createdAt,
    })
    .from(parcels)
    .innerJoin(merchants, eq(merchants.id, parcels.merchantId))
    .innerJoin(townships, eq(townships.id, parcels.townshipId))
    .leftJoin(riders, eq(riders.id, parcels.riderId))
    .leftJoin(appUsers, eq(appUsers.id, riders.userId))
    .where(and(isNull(parcels.deletedAt), eq(riders.userId, riderUserId)));
}

export function buildGetParcelSummaryQuery() {
  return db
    .select({
      status: parcels.status,
      codAmount: parcels.codAmount,
      deliveryFee: parcels.deliveryFee,
      parcelType: parcels.parcelType,
      riderId: parcels.riderId,
    })
    .from(parcels)
    .where(isNull(parcels.deletedAt));
}

export function buildMerchantsParcelAggregationQuery() {
  return db
    .select({
      merchantId: parcels.merchantId,
      codAmount: parcels.codAmount,
      deliveryFee: parcels.deliveryFee,
      status: parcels.status,
    })
    .from(parcels)
    .where(isNull(parcels.deletedAt));
}

export function buildRidersParcelAggregationQuery() {
  return db
    .select({
      riderId: parcels.riderId,
      codAmount: parcels.codAmount,
      deliveryFee: parcels.deliveryFee,
      parcelType: parcels.parcelType,
      collectedAmount: parcels.collectedAmount,
      status: parcels.status,
    })
    .from(parcels)
    .where(isNull(parcels.deletedAt));
}

export function buildPendingRiderCashHandoversQuery() {
  return db
    .select({
      riderId: riders.id,
      parcelId: parcels.id,
    })
    .from(parcels)
    .innerJoin(riders, eq(riders.id, parcels.riderId))
    .where(
      and(
        isNull(parcels.deletedAt),
        eq(parcels.status, "delivered"),
        eq(parcels.isReceivedByOffice, false),
      ),
    );
}

export function buildEligibleSettlementFinancialItemsQuery() {
  return db
    .select({
      merchantId: financialItems.merchantId,
      itemId: financialItems.id,
    })
    .from(financialItems)
    .innerJoin(merchants, eq(merchants.id, financialItems.merchantId))
    .leftJoin(parcels, eq(parcels.id, financialItems.parcelId))
    .where(and(isNull(financialItems.merchantSettlementId), eq(financialItems.status, "pending")));
}
