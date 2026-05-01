import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import {
    type AuditLogInsertInput,
    type CreateParcelInsertInput,
    type MerchantParcelStatsDto,
    type PaginatedParcelListDto,
    type CreatePaymentInsertInput,
    type ParcelDetailDto,
    type ParcelListItemDto,
    type ParcelOptionDto,
    type ParcelPaymentUpdatePatch,
    type ParcelUpdateContextDto,
    type ParcelUpdatePatch,
    toMerchantParcelStatsDto,
    toParcelDetailDto,
    toParcelListItemDto,
    toParcelUpdateContextDto,
} from "./dto";
import { db } from "@/db";
import {
    appUsers,
    merchants,
    merchantFinancialItems,
    parcelAuditLogs,
    parcelPaymentRecords,
    parcels,
    riders,
    townships,
} from "@/db/schema";
import {
    getParcelAccess,
    getRiderParcelActionAccess,
} from "@/features/auth/server/policies/parcels";
import { isAdminRole } from "@/features/auth/server/policies/shared";
import { reconcileMerchantFinancialItemsForParcelWithClient } from "@/features/merchant-settlements/server/merchant-financial-item-dal";
import {
    getDefaultParcelListQuery,
    normalizePatchValue,
    signParcelImageKeys,
    toParcelSearchPattern,
} from "@/features/parcels/server/utils";

import type { ParcelListQuery, ParcelPaymentWriteValues, ParcelWriteValues } from "./utils";
import type { AppAccessViewer } from "@/features/auth/server/dto";

type ParcelWriteTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const deliveryFeeStatusValue = sql<ParcelListItemDto["deliveryFeeStatus"]>`
    coalesce(${parcelPaymentRecords.deliveryFeeStatus}, 'unpaid')
`;
const codStatusValue = sql<ParcelListItemDto["codStatus"]>`
    case
        when ${parcels.parcelType} = 'non_cod' then 'not_applicable'
        else coalesce(${parcelPaymentRecords.codStatus}, 'pending')
    end
`;
const collectionStatusValue = sql<ParcelListItemDto["collectionStatus"]>`
    case
        when ${parcels.parcelType} = 'non_cod' then 'void'
        else coalesce(${parcelPaymentRecords.collectionStatus}, 'pending')
    end
`;
const merchantSettlementStatusValue = sql<ParcelListItemDto["merchantSettlementStatus"]>`
    coalesce(${parcelPaymentRecords.merchantSettlementStatus}, 'pending')
`;

async function listParcels(
    input: ParcelListQuery = getDefaultParcelListQuery(),
): Promise<PaginatedParcelListDto> {
    const searchPattern = toParcelSearchPattern(input.query);
    const filters = and(
        searchPattern
            ? or(
                  ilike(parcels.parcelCode, searchPattern),
                  ilike(parcels.recipientName, searchPattern),
                  ilike(parcels.recipientPhone, searchPattern),
                  ilike(townships.name, searchPattern),
                  ilike(merchants.shopName, searchPattern),
              )
            : undefined,
        input.parcelStatus.length > 0 ? inArray(parcels.status, input.parcelStatus) : undefined,
        input.codStatus.length > 0 ? inArray(codStatusValue, input.codStatus) : undefined,
        input.collectionStatus.length > 0
            ? inArray(collectionStatusValue, input.collectionStatus)
            : undefined,
        input.deliveryFeeStatus.length > 0
            ? inArray(deliveryFeeStatusValue, input.deliveryFeeStatus)
            : undefined,
        input.merchantSettlementStatus.length > 0
            ? inArray(merchantSettlementStatusValue, input.merchantSettlementStatus)
            : undefined,
    );
    const [totalRow] = await db
        .select({ totalItems: count(parcels.id) })
        .from(parcels)
        .innerJoin(merchants, eq(parcels.merchantId, merchants.appUserId))
        .leftJoin(townships, eq(parcels.recipientTownshipId, townships.id))
        .leftJoin(parcelPaymentRecords, eq(parcelPaymentRecords.parcelId, parcels.id))
        .where(filters);
    const totalItems = totalRow?.totalItems ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / input.pageSize));
    const page = Math.min(input.page, totalPages);
    const offset = (page - 1) * input.pageSize;
    const rows =
        totalItems === 0
            ? []
            : await db
                  .select({
                      id: parcels.id,
                      parcelCode: parcels.parcelCode,
                      merchantId: parcels.merchantId,
                      riderId: parcels.riderId,
                      merchantLabel: merchants.shopName,
                      recipientName: parcels.recipientName,
                      recipientPhone: parcels.recipientPhone,
                      recipientTownshipName: townships.name,
                      parcelType: parcels.parcelType,
                      codAmount: parcels.codAmount,
                      deliveryFee: parcels.deliveryFee,
                      totalAmountToCollect: parcels.totalAmountToCollect,
                      deliveryFeePayer: parcels.deliveryFeePayer,
                      deliveryFeePaymentPlan: parcels.deliveryFeePaymentPlan,
                      parcelStatus: parcels.status,
                      deliveryFeeStatus: deliveryFeeStatusValue,
                      codStatus: codStatusValue,
                      collectedAmount: parcelPaymentRecords.collectedAmount,
                      collectionStatus: collectionStatusValue,
                      merchantSettlementStatus: merchantSettlementStatusValue,
                      merchantSettlementId: parcelPaymentRecords.merchantSettlementId,
                      createdAt: parcels.createdAt,
                  })
                  .from(parcels)
                  .innerJoin(merchants, eq(parcels.merchantId, merchants.appUserId))
                  .leftJoin(townships, eq(parcels.recipientTownshipId, townships.id))
                  .leftJoin(parcelPaymentRecords, eq(parcelPaymentRecords.parcelId, parcels.id))
                  .where(filters)
                  .orderBy(desc(parcels.createdAt), desc(parcels.id))
                  .limit(input.pageSize)
                  .offset(offset);

    return {
        items: rows.map((row) => toParcelListItemDto(row)),
        page,
        pageSize: input.pageSize,
        totalItems,
        totalPages,
    };
}

export async function getParcelsListForViewer(
    viewer: AppAccessViewer,
    input: ParcelListQuery = getDefaultParcelListQuery(),
): Promise<PaginatedParcelListDto> {
    const parcelAccess = getParcelAccess({ viewer });

    if (!parcelAccess.canViewList) {
        return {
            items: [],
            page: 1,
            pageSize: input.pageSize,
            totalItems: 0,
            totalPages: 1,
        };
    }

    return listParcels(input);
}

async function listMerchantParcels(
    merchantId: string,
    input: ParcelListQuery = getDefaultParcelListQuery(),
): Promise<PaginatedParcelListDto> {
    const searchPattern = toParcelSearchPattern(input.query);
    const filters = and(
        eq(parcels.merchantId, merchantId),
        searchPattern
            ? or(
                  ilike(parcels.parcelCode, searchPattern),
                  ilike(parcels.recipientName, searchPattern),
                  ilike(parcels.recipientPhone, searchPattern),
                  ilike(townships.name, searchPattern),
              )
            : undefined,
        input.parcelStatus.length > 0 ? inArray(parcels.status, input.parcelStatus) : undefined,
        input.codStatus.length > 0 ? inArray(codStatusValue, input.codStatus) : undefined,
        input.collectionStatus.length > 0
            ? inArray(collectionStatusValue, input.collectionStatus)
            : undefined,
        input.deliveryFeeStatus.length > 0
            ? inArray(deliveryFeeStatusValue, input.deliveryFeeStatus)
            : undefined,
        input.merchantSettlementStatus.length > 0
            ? inArray(merchantSettlementStatusValue, input.merchantSettlementStatus)
            : undefined,
    );
    const [totalRow] = await db
        .select({ totalItems: count(parcels.id) })
        .from(parcels)
        .innerJoin(merchants, eq(parcels.merchantId, merchants.appUserId))
        .leftJoin(townships, eq(parcels.recipientTownshipId, townships.id))
        .leftJoin(parcelPaymentRecords, eq(parcelPaymentRecords.parcelId, parcels.id))
        .where(filters);
    const totalItems = totalRow?.totalItems ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / input.pageSize));
    const page = Math.min(input.page, totalPages);
    const offset = (page - 1) * input.pageSize;
    const rows =
        totalItems === 0
            ? []
            : await db
                  .select({
                      id: parcels.id,
                      parcelCode: parcels.parcelCode,
                      merchantId: parcels.merchantId,
                      riderId: parcels.riderId,
                      merchantLabel: merchants.shopName,
                      recipientName: parcels.recipientName,
                      recipientPhone: parcels.recipientPhone,
                      recipientTownshipName: townships.name,
                      parcelType: parcels.parcelType,
                      codAmount: parcels.codAmount,
                      deliveryFee: parcels.deliveryFee,
                      totalAmountToCollect: parcels.totalAmountToCollect,
                      deliveryFeePayer: parcels.deliveryFeePayer,
                      deliveryFeePaymentPlan: parcels.deliveryFeePaymentPlan,
                      parcelStatus: parcels.status,
                      deliveryFeeStatus: deliveryFeeStatusValue,
                      codStatus: codStatusValue,
                      collectedAmount: parcelPaymentRecords.collectedAmount,
                      collectionStatus: collectionStatusValue,
                      merchantSettlementStatus: merchantSettlementStatusValue,
                      merchantSettlementId: parcelPaymentRecords.merchantSettlementId,
                      createdAt: parcels.createdAt,
                  })
                  .from(parcels)
                  .innerJoin(merchants, eq(parcels.merchantId, merchants.appUserId))
                  .leftJoin(townships, eq(parcels.recipientTownshipId, townships.id))
                  .leftJoin(parcelPaymentRecords, eq(parcelPaymentRecords.parcelId, parcels.id))
                  .where(filters)
                  .orderBy(desc(parcels.createdAt), desc(parcels.id))
                  .limit(input.pageSize)
                  .offset(offset);

    return {
        items: rows.map((row) => toParcelListItemDto(row)),
        page,
        pageSize: input.pageSize,
        totalItems,
        totalPages,
    };
}

async function getMerchantParcelStats(merchantId: string): Promise<MerchantParcelStatsDto> {
    const positiveCodRemitAmountSql = sql<string>`greatest(${merchantFinancialItems.amount}, 0)`;
    const [[parcelStatsRow], [codSettlementRow]] = await Promise.all([
        db
            .select({
                totalParcels: count(parcels.id),
                deliveredParcels: sql<number>`
                    count(*) filter (where ${parcels.status} = 'delivered')::int
                `,
                returnedParcels: sql<number>`
                    count(*) filter (where ${parcels.status} = 'returned')::int
                `,
                totalCodCollected: sql<string>`
                    coalesce(
                        sum(
                            case
                                when ${parcelPaymentRecords.codStatus} = 'collected'
                                then ${parcels.codAmount}
                                else 0
                            end
                        ),
                        0
                    )::numeric(12, 2)::text
                `,
                pendingDeliveryFee: sql<string>`
                    coalesce(
                        sum(
                            case
                                when ${parcelPaymentRecords.deliveryFeeStatus} = 'bill_merchant'
                                    or (
                                        ${parcels.deliveryFeePayer} = 'merchant'
                                        and ${parcelPaymentRecords.deliveryFeeStatus}
                                            in ('unpaid', 'bill_merchant')
                                    )
                                then ${parcels.deliveryFee}
                                else 0
                            end
                        ),
                        0
                    )::numeric(12, 2)::text
                `,
            })
            .from(parcels)
            .leftJoin(parcelPaymentRecords, eq(parcelPaymentRecords.parcelId, parcels.id))
            .where(eq(parcels.merchantId, merchantId)),
        db
            .select({
                // Use settlement item truth instead of the legacy parcel-level flag.
                // A parcel can still have another open merchant financial item after its COD remit
                // has already been settled, which leaves the legacy status at "pending".
                codRemitted: sql<string>`
                    coalesce(
                        sum(
                            case
                                when ${merchantFinancialItems.lifecycleState} = 'closed'
                                then ${positiveCodRemitAmountSql}
                                else 0
                            end
                        ),
                        0
                    )::numeric(12, 2)::text
                `,
                codInHeld: sql<string>`
                    coalesce(
                        sum(
                            case
                                when ${merchantFinancialItems.lifecycleState} in ('open', 'locked')
                                    and ${parcels.parcelType} = 'cod'
                                    and ${parcels.status} = 'delivered'
                                    and ${parcelPaymentRecords.codStatus} = 'collected'
                                    and ${parcelPaymentRecords.collectionStatus}
                                        = 'received_by_office'
                                then ${positiveCodRemitAmountSql}
                                else 0
                            end
                        ),
                        0
                    )::numeric(12, 2)::text
                `,
            })
            .from(merchantFinancialItems)
            .leftJoin(parcels, eq(merchantFinancialItems.sourceParcelId, parcels.id))
            .leftJoin(
                parcelPaymentRecords,
                eq(merchantFinancialItems.sourcePaymentRecordId, parcelPaymentRecords.id),
            )
            .where(
                and(
                    eq(merchantFinancialItems.merchantId, merchantId),
                    eq(merchantFinancialItems.kind, "cod_remit_credit"),
                ),
            ),
    ]);

    return toMerchantParcelStatsDto({
        totalParcels: parcelStatsRow?.totalParcels ?? 0,
        deliveredParcels: parcelStatsRow?.deliveredParcels ?? 0,
        returnedParcels: parcelStatsRow?.returnedParcels ?? 0,
        totalCodCollected: parcelStatsRow?.totalCodCollected ?? "0",
        codRemitted: codSettlementRow?.codRemitted ?? "0",
        codInHeld: codSettlementRow?.codInHeld ?? "0",
        pendingDeliveryFee: parcelStatsRow?.pendingDeliveryFee ?? "0",
    });
}

export async function getMerchantParcelsListForViewer(
    viewer: AppAccessViewer,
    merchantId: string,
    input: ParcelListQuery = getDefaultParcelListQuery(),
): Promise<PaginatedParcelListDto> {
    const parcelAccess = getParcelAccess({
        viewer,
        parcel: {
            merchantId,
        },
    });

    if (!parcelAccess.canView) {
        return {
            items: [],
            page: 1,
            pageSize: input.pageSize,
            totalItems: 0,
            totalPages: 1,
        };
    }

    const safeInput = isAdminRole(viewer.roleSlug)
        ? input
        : {
              ...input,
              collectionStatus: [],
              deliveryFeeStatus: [],
          };

    return listMerchantParcels(merchantId, safeInput);
}

export async function getMerchantParcelStatsForViewer(
    viewer: AppAccessViewer,
    merchantId: string,
): Promise<MerchantParcelStatsDto> {
    const parcelAccess = getParcelAccess({
        viewer,
        parcel: {
            merchantId,
        },
    });

    if (!parcelAccess.canView) {
        return toMerchantParcelStatsDto({
            totalParcels: 0,
            deliveredParcels: 0,
            returnedParcels: 0,
            totalCodCollected: "0",
            codRemitted: "0",
            codInHeld: "0",
            pendingDeliveryFee: "0",
        });
    }

    return getMerchantParcelStats(merchantId);
}

async function listAssignedRiderParcels(riderId: string): Promise<ParcelListItemDto[]> {
    const rows = await db
        .select({
            id: parcels.id,
            parcelCode: parcels.parcelCode,
            merchantId: parcels.merchantId,
            riderId: parcels.riderId,
            merchantLabel: merchants.shopName,
            recipientName: parcels.recipientName,
            recipientPhone: parcels.recipientPhone,
            recipientTownshipName: townships.name,
            parcelType: parcels.parcelType,
            codAmount: parcels.codAmount,
            deliveryFee: parcels.deliveryFee,
            totalAmountToCollect: parcels.totalAmountToCollect,
            deliveryFeePayer: parcels.deliveryFeePayer,
            deliveryFeePaymentPlan: parcels.deliveryFeePaymentPlan,
            parcelStatus: parcels.status,
            deliveryFeeStatus: parcelPaymentRecords.deliveryFeeStatus,
            codStatus: parcelPaymentRecords.codStatus,
            collectedAmount: parcelPaymentRecords.collectedAmount,
            collectionStatus: parcelPaymentRecords.collectionStatus,
            merchantSettlementStatus: parcelPaymentRecords.merchantSettlementStatus,
            merchantSettlementId: parcelPaymentRecords.merchantSettlementId,
            createdAt: parcels.createdAt,
        })
        .from(parcels)
        .innerJoin(merchants, eq(parcels.merchantId, merchants.appUserId))
        .leftJoin(townships, eq(parcels.recipientTownshipId, townships.id))
        .leftJoin(parcelPaymentRecords, eq(parcelPaymentRecords.parcelId, parcels.id))
        .where(eq(parcels.riderId, riderId))
        .orderBy(desc(parcels.createdAt));

    return rows.map((row) => toParcelListItemDto(row));
}

export async function getAssignedRiderParcelsListForViewer(
    viewer: AppAccessViewer,
    riderId: string,
): Promise<ParcelListItemDto[]> {
    const riderParcelActionAccess = getRiderParcelActionAccess({
        viewer,
        parcel: {
            riderId,
        },
    });
    const riderAccess = viewer.permissions.includes("rider.view");

    if (!riderParcelActionAccess.canViewAssignedParcel && !riderAccess) {
        return [];
    }

    return listAssignedRiderParcels(riderId);
}

async function findParcelDetailRowById(parcelId: string) {
    const [row] = await db
        .select({
            id: parcels.id,
            parcelCode: parcels.parcelCode,
            merchantId: parcels.merchantId,
            merchantLabel: merchants.shopName,
            riderId: parcels.riderId,
            riderLabel: appUsers.fullName,
            pickupLocationId: parcels.pickupLocationId,
            merchantContactId: parcels.merchantContactId,
            pickupLocationLabel: parcels.pickupLocationLabel,
            pickupTownshipId: parcels.pickupTownshipId,
            pickupTownshipName: sql<string | null>`(
                select ${townships.name}
                from ${townships}
                where ${townships.id} = ${parcels.pickupTownshipId}
                limit 1
            )`,
            pickupAddress: parcels.pickupAddress,
            pickupContactName: parcels.pickupContactName,
            pickupContactPhone: parcels.pickupContactPhone,
            recipientContactLabel: parcels.recipientContactLabel,
            recipientName: parcels.recipientName,
            recipientPhone: parcels.recipientPhone,
            recipientTownshipId: parcels.recipientTownshipId,
            recipientTownshipName: townships.name,
            recipientAddress: parcels.recipientAddress,
            parcelDescription: parcels.parcelDescription,
            packageCount: parcels.packageCount,
            specialHandlingNote: parcels.specialHandlingNote,
            estimatedWeightKg: parcels.estimatedWeightKg,
            isLargeItem: parcels.isLargeItem,
            packageWidthCm: parcels.packageWidthCm,
            packageHeightCm: parcels.packageHeightCm,
            packageLengthCm: parcels.packageLengthCm,
            pickupImageKeys: parcels.pickupImageKeys,
            proofOfDeliveryImageKeys: parcels.proofOfDeliveryImageKeys,
            parcelType: parcels.parcelType,
            codAmount: parcels.codAmount,
            deliveryFee: parcels.deliveryFee,
            totalAmountToCollect: parcels.totalAmountToCollect,
            deliveryFeePayer: parcels.deliveryFeePayer,
            deliveryFeePaymentPlan: parcels.deliveryFeePaymentPlan,
            parcelStatus: parcels.status,
            deliveryFeeStatus: parcelPaymentRecords.deliveryFeeStatus,
            codStatus: parcelPaymentRecords.codStatus,
            collectedAmount: parcelPaymentRecords.collectedAmount,
            collectionStatus: parcelPaymentRecords.collectionStatus,
            merchantSettlementStatus: parcelPaymentRecords.merchantSettlementStatus,
            merchantSettlementId: parcelPaymentRecords.merchantSettlementId,
            riderPayoutStatus: parcelPaymentRecords.riderPayoutStatus,
            paymentNote: parcelPaymentRecords.note,
            paymentSlipImageKeys: parcelPaymentRecords.paymentSlipImageKeys,
            createdAt: parcels.createdAt,
            updatedAt: parcels.updatedAt,
        })
        .from(parcels)
        .innerJoin(merchants, eq(parcels.merchantId, merchants.appUserId))
        .leftJoin(riders, eq(parcels.riderId, riders.appUserId))
        .leftJoin(appUsers, eq(riders.appUserId, appUsers.id))
        .leftJoin(townships, eq(parcels.recipientTownshipId, townships.id))
        .leftJoin(parcelPaymentRecords, eq(parcelPaymentRecords.parcelId, parcels.id))
        .where(eq(parcels.id, parcelId))
        .limit(1);

    return row ?? null;
}

export async function getParcelByIdForViewer(
    viewer: AppAccessViewer,
    parcelId: string,
): Promise<ParcelDetailDto | null> {
    const row = await findParcelDetailRowById(parcelId);

    if (!row) {
        return null;
    }

    const parcelAccess = getParcelAccess({
        viewer,
        parcel: {
            merchantId: row.merchantId,
            riderId: row.riderId,
        },
    });

    if (!parcelAccess.canView) {
        return null;
    }

    const pickupImageKeys = row.pickupImageKeys ?? [];
    const proofOfDeliveryImageKeys = row.proofOfDeliveryImageKeys ?? [];
    const paymentSlipImageKeys = row.paymentSlipImageKeys ?? [];

    return toParcelDetailDto({
        ...row,
        pickupImages: await signParcelImageKeys(pickupImageKeys),
        proofOfDeliveryImages: await signParcelImageKeys(proofOfDeliveryImageKeys),
        paymentSlipImages:
            viewer.roleSlug === "merchant" ? [] : await signParcelImageKeys(paymentSlipImageKeys),
    });
}

export async function isParcelCodeInUse(parcelCode: string): Promise<boolean> {
    const [row] = await db
        .select({ id: parcels.id })
        .from(parcels)
        .where(eq(parcels.parcelCode, parcelCode))
        .limit(1);

    return Boolean(row?.id);
}

export async function getParcelFormOptions(input?: { merchantId?: string | null }): Promise<{
    merchants: ParcelOptionDto[];
    riders: ParcelOptionDto[];
    townships: ParcelOptionDto[];
}> {
    const [merchantRows, riderRows, townshipRows] = await Promise.all([
        db
            .select({
                id: merchants.appUserId,
                label: merchants.shopName,
            })
            .from(merchants)
            .where(
                input?.merchantId
                    ? and(isNull(merchants.deletedAt), eq(merchants.appUserId, input.merchantId))
                    : isNull(merchants.deletedAt),
            )
            .orderBy(asc(merchants.shopName)),
        db
            .select({
                id: riders.appUserId,
                label: appUsers.fullName,
            })
            .from(riders)
            .innerJoin(appUsers, eq(riders.appUserId, appUsers.id))
            .where(
                and(
                    isNull(riders.deletedAt),
                    isNull(appUsers.deletedAt),
                    eq(riders.isActive, true),
                ),
            )
            .orderBy(asc(appUsers.fullName)),
        db
            .select({
                id: townships.id,
                label: townships.name,
            })
            .from(townships)
            .where(eq(townships.isActive, true))
            .orderBy(asc(townships.name)),
    ]);

    return {
        merchants: merchantRows,
        riders: riderRows,
        townships: townshipRows,
    };
}

export async function createParcelWithPaymentAndAudit(input: {
    actorAppUserId: string;
    parcelValues: CreateParcelInsertInput;
    paymentValues: CreatePaymentInsertInput;
}) {
    const created = await db.transaction(async (tx) => {
        const [parcel] = await tx
            .insert(parcels)
            .values({
                ...input.parcelValues,
            })
            .returning({ id: parcels.id });

        const [payment] = await tx
            .insert(parcelPaymentRecords)
            .values({
                parcelId: parcel.id,
                ...input.paymentValues,
            })
            .returning({ id: parcelPaymentRecords.id });

        const parcelAuditPayload: AuditLogInsertInput = {
            parcelId: parcel.id,
            updatedBy: input.actorAppUserId,
            sourceTable: "parcels",
            event: "parcel.create",
            oldValues: null,
            newValues: input.parcelValues,
        };
        const paymentAuditPayload: AuditLogInsertInput = {
            parcelId: parcel.id,
            updatedBy: input.actorAppUserId,
            sourceTable: "parcel_payment_records",
            event: "parcel_payment_record.create",
            oldValues: null,
            newValues: input.paymentValues,
        };

        await tx.insert(parcelAuditLogs).values([parcelAuditPayload, paymentAuditPayload]);
        await reconcileMerchantFinancialItemsForParcelWithClient(tx, parcel.id);

        return { parcelId: parcel.id, paymentRecordId: payment.id };
    });

    return created;
}

export async function createParcelsWithPaymentsAndAudit(input: {
    actorAppUserId: string;
    items?: Array<{
        parcelValues: CreateParcelInsertInput;
        paymentValues: CreatePaymentInsertInput;
    }>;
    buildItems?: (tx: ParcelWriteTransaction) => Promise<
        Array<{
            parcelValues: CreateParcelInsertInput;
            paymentValues: CreatePaymentInsertInput;
        }>
    >;
    beforeCreate?: (tx: ParcelWriteTransaction) => Promise<void>;
}) {
    const created = await db.transaction(async (tx) => {
        const results: Array<{ parcelId: string; paymentRecordId: string }> = [];

        if (input.beforeCreate) {
            await input.beforeCreate(tx);
        }

        const items = input.buildItems ? await input.buildItems(tx) : (input.items ?? []);

        for (const item of items) {
            const [parcel] = await tx
                .insert(parcels)
                .values({
                    ...item.parcelValues,
                })
                .returning({ id: parcels.id });

            const [payment] = await tx
                .insert(parcelPaymentRecords)
                .values({
                    parcelId: parcel.id,
                    ...item.paymentValues,
                })
                .returning({ id: parcelPaymentRecords.id });

            const parcelAuditPayload: AuditLogInsertInput = {
                parcelId: parcel.id,
                updatedBy: input.actorAppUserId,
                sourceTable: "parcels",
                event: "parcel.create",
                oldValues: null,
                newValues: item.parcelValues,
            };
            const paymentAuditPayload: AuditLogInsertInput = {
                parcelId: parcel.id,
                updatedBy: input.actorAppUserId,
                sourceTable: "parcel_payment_records",
                event: "parcel_payment_record.create",
                oldValues: null,
                newValues: item.paymentValues,
            };

            await tx.insert(parcelAuditLogs).values([parcelAuditPayload, paymentAuditPayload]);
            await reconcileMerchantFinancialItemsForParcelWithClient(tx, parcel.id);

            results.push({ parcelId: parcel.id, paymentRecordId: payment.id });
        }

        return results;
    });

    return created;
}

async function findParcelUpdateContextById(
    parcelId: string,
): Promise<ParcelUpdateContextDto | null> {
    const [row] = await db
        .select({
            parcelId: parcels.id,
            parcelCode: parcels.parcelCode,
            merchantId: parcels.merchantId,
            riderId: parcels.riderId,
            pickupLocationId: parcels.pickupLocationId,
            merchantContactId: parcels.merchantContactId,
            pickupTownshipId: parcels.pickupTownshipId,
            pickupLocationLabel: parcels.pickupLocationLabel,
            pickupAddress: parcels.pickupAddress,
            pickupContactName: parcels.pickupContactName,
            pickupContactPhone: parcels.pickupContactPhone,
            recipientContactLabel: parcels.recipientContactLabel,
            recipientName: parcels.recipientName,
            recipientPhone: parcels.recipientPhone,
            recipientTownshipId: parcels.recipientTownshipId,
            recipientAddress: parcels.recipientAddress,
            parcelDescription: parcels.parcelDescription,
            packageCount: parcels.packageCount,
            specialHandlingNote: parcels.specialHandlingNote,
            estimatedWeightKg: parcels.estimatedWeightKg,
            isLargeItem: parcels.isLargeItem,
            packageWidthCm: parcels.packageWidthCm,
            packageHeightCm: parcels.packageHeightCm,
            packageLengthCm: parcels.packageLengthCm,
            pickupImageKeys: parcels.pickupImageKeys,
            proofOfDeliveryImageKeys: parcels.proofOfDeliveryImageKeys,
            parcelType: parcels.parcelType,
            codAmount: parcels.codAmount,
            deliveryFee: parcels.deliveryFee,
            totalAmountToCollect: parcels.totalAmountToCollect,
            deliveryFeePayer: parcels.deliveryFeePayer,
            deliveryFeePaymentPlan: parcels.deliveryFeePaymentPlan,
            parcelStatus: parcels.status,
            paymentId: parcelPaymentRecords.id,
            deliveryFeeStatus: parcelPaymentRecords.deliveryFeeStatus,
            codStatus: parcelPaymentRecords.codStatus,
            collectedAmount: parcelPaymentRecords.collectedAmount,
            collectionStatus: parcelPaymentRecords.collectionStatus,
            merchantSettlementStatus: parcelPaymentRecords.merchantSettlementStatus,
            merchantSettlementId: parcelPaymentRecords.merchantSettlementId,
            riderPayoutStatus: parcelPaymentRecords.riderPayoutStatus,
            paymentNote: parcelPaymentRecords.note,
            paymentSlipImageKeys: parcelPaymentRecords.paymentSlipImageKeys,
        })
        .from(parcels)
        .leftJoin(parcelPaymentRecords, eq(parcelPaymentRecords.parcelId, parcels.id))
        .where(eq(parcels.id, parcelId))
        .limit(1);

    if (!row?.paymentId) {
        return null;
    }

    return toParcelUpdateContextDto(row);
}

export async function getParcelUpdateContextForViewer(
    viewer: AppAccessViewer,
    parcelId: string,
): Promise<ParcelUpdateContextDto | null> {
    const current = await findParcelUpdateContextById(parcelId);

    if (!current) {
        return null;
    }

    const parcelAccess = getParcelAccess({
        viewer,
        parcel: {
            merchantId: current.parcel.merchantId,
            riderId: current.parcel.riderId,
        },
    });

    if (!parcelAccess.canView) {
        return null;
    }

    return current;
}

export async function updateParcelAndPaymentWithAudit(input: {
    actorAppUserId: string;
    parcelId: string;
    parcelPatch: ParcelUpdatePatch;
    paymentPatch: ParcelPaymentUpdatePatch;
    parcelOldValues: Record<string, unknown> | null;
    paymentOldValues: Record<string, unknown> | null;
    parcelEvent: string;
    paymentEvent?: string;
    auditMetadata?: Record<string, unknown>;
    beforeCommit?: (tx: ParcelWriteTransaction) => Promise<void>;
}) {
    await db.transaction(async (tx) => {
        if (input.beforeCommit) {
            await input.beforeCommit(tx);
        }

        if (Object.keys(input.parcelPatch).length > 0) {
            await tx
                .update(parcels)
                .set({
                    ...input.parcelPatch,
                    updatedAt: new Date(),
                })
                .where(eq(parcels.id, input.parcelId));

            await tx.insert(parcelAuditLogs).values({
                parcelId: input.parcelId,
                updatedBy: input.actorAppUserId,
                sourceTable: "parcels",
                event: input.parcelEvent,
                oldValues: input.parcelOldValues,
                newValues: input.auditMetadata
                    ? { ...input.parcelPatch, ...input.auditMetadata }
                    : input.parcelPatch,
            });
        }

        if (Object.keys(input.paymentPatch).length > 0) {
            await tx
                .update(parcelPaymentRecords)
                .set({
                    ...input.paymentPatch,
                    updatedAt: new Date(),
                })
                .where(eq(parcelPaymentRecords.parcelId, input.parcelId));

            await tx.insert(parcelAuditLogs).values({
                parcelId: input.parcelId,
                updatedBy: input.actorAppUserId,
                sourceTable: "parcel_payment_records",
                event: input.paymentEvent ?? "parcel_payment_record.update",
                oldValues: input.paymentOldValues,
                newValues: input.auditMetadata
                    ? { ...input.paymentPatch, ...input.auditMetadata }
                    : input.paymentPatch,
            });
        }

        await reconcileMerchantFinancialItemsForParcelWithClient(tx, input.parcelId);
    });
}

export function buildParcelPatch(input: {
    current: ParcelUpdateContextDto["parcel"];
    next: ParcelWriteValues;
}) {
    const patch: ParcelUpdatePatch = {};
    const oldValues: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input.next)) {
        const keyName = key as keyof ParcelUpdatePatch;
        const currentValue = input.current[keyName];

        if (normalizePatchValue(currentValue) !== normalizePatchValue(value)) {
            patch[keyName] = value as never;
            oldValues[keyName] = currentValue;
        }
    }

    return { patch, oldValues: Object.keys(oldValues).length > 0 ? oldValues : null };
}

export function buildPaymentPatch(input: {
    current: ParcelUpdateContextDto["payment"];
    next: ParcelPaymentWriteValues;
}) {
    const patch: ParcelPaymentUpdatePatch = {};
    const oldValues: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input.next)) {
        const keyName = key as keyof ParcelPaymentUpdatePatch;
        const currentValue = input.current[keyName];

        if (normalizePatchValue(currentValue) !== normalizePatchValue(value)) {
            patch[keyName] = value as never;
            oldValues[keyName] = currentValue;
        }
    }

    return { patch, oldValues: Object.keys(oldValues).length > 0 ? oldValues : null };
}
