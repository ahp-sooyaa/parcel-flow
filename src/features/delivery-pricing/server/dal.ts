import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import {
    toDeliveryPricingOptionDto,
    toDeliveryPricingQuoteDto,
    toDeliveryPricingRateDto,
    type DeliveryPricingOptionDto,
    type DeliveryPricingQuoteDto,
    type DeliveryPricingRateDto,
} from "./dto";
import {
    calculateDeliveryFeeFromRate,
    resolveChargeableWeightKg,
    toMoneyString,
    type DeliveryPricingQuoteInput,
    type DeliveryPricingRateInput,
    type UpdateDeliveryPricingRateInput,
} from "./utils";
import { db } from "@/db";
import { appUsers, deliveryPricingRates, merchants, townships } from "@/db/schema";
import { getDeliveryPricingAccess } from "@/features/auth/server/policies/delivery-pricing";

import type { AppAccessViewer } from "@/features/auth/server/dto";

export async function listDeliveryPricingRates(): Promise<DeliveryPricingRateDto[]> {
    const rows = await db
        .select({
            id: deliveryPricingRates.id,
            townshipId: deliveryPricingRates.townshipId,
            townshipName: townships.name,
            merchantId: deliveryPricingRates.merchantId,
            merchantLabel: merchants.shopName,
            baseWeightKg: deliveryPricingRates.baseWeightKg,
            baseFee: deliveryPricingRates.baseFee,
            extraWeightUnitKg: deliveryPricingRates.extraWeightUnitKg,
            extraWeightFee: deliveryPricingRates.extraWeightFee,
            volumetricDivisor: deliveryPricingRates.volumetricDivisor,
            codFeePercent: deliveryPricingRates.codFeePercent,
            returnFeePercent: deliveryPricingRates.returnFeePercent,
            isActive: deliveryPricingRates.isActive,
            createdAt: deliveryPricingRates.createdAt,
            updatedAt: deliveryPricingRates.updatedAt,
        })
        .from(deliveryPricingRates)
        .innerJoin(townships, eq(deliveryPricingRates.townshipId, townships.id))
        .leftJoin(merchants, eq(deliveryPricingRates.merchantId, merchants.appUserId))
        .orderBy(
            asc(townships.name),
            sql`${deliveryPricingRates.merchantId} is not null`,
            asc(merchants.shopName),
            desc(deliveryPricingRates.isActive),
            desc(deliveryPricingRates.updatedAt),
        );

    return rows.map((row) =>
        toDeliveryPricingRateDto({
            id: row.id,
            townshipId: row.townshipId,
            townshipName: row.townshipName,
            merchantId: row.merchantId,
            merchantLabel: row.merchantLabel,
            scope: row.merchantId ? "merchant_specific" : "global",
            baseWeightKg: row.baseWeightKg,
            baseFee: row.baseFee,
            extraWeightUnitKg: row.extraWeightUnitKg,
            extraWeightFee: row.extraWeightFee,
            volumetricDivisor: row.volumetricDivisor,
            codFeePercent: row.codFeePercent,
            returnFeePercent: row.returnFeePercent,
            isActive: row.isActive,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        }),
    );
}

export async function getDeliveryPricingRatesForViewer(
    viewer: AppAccessViewer,
): Promise<DeliveryPricingRateDto[]> {
    const access = getDeliveryPricingAccess(viewer);

    if (!access.canView) {
        return [];
    }

    return listDeliveryPricingRates();
}

export async function getDeliveryPricingFormOptions(): Promise<{
    merchants: DeliveryPricingOptionDto[];
    townships: DeliveryPricingOptionDto[];
}> {
    const [merchantRows, townshipRows] = await Promise.all([
        db
            .select({
                id: merchants.appUserId,
                label: sql<string>`${merchants.shopName} || ' · ' || ${appUsers.fullName}`,
            })
            .from(merchants)
            .innerJoin(appUsers, eq(merchants.appUserId, appUsers.id))
            .where(and(isNull(merchants.deletedAt), isNull(appUsers.deletedAt)))
            .orderBy(asc(merchants.shopName), asc(appUsers.fullName)),
        db
            .select({
                id: townships.id,
                label: townships.name,
            })
            .from(townships)
            .orderBy(asc(townships.name)),
    ]);

    return {
        merchants: merchantRows.map((row) => toDeliveryPricingOptionDto(row)),
        townships: townshipRows.map((row) => toDeliveryPricingOptionDto(row)),
    };
}

export async function findDeliveryPricingRateById(rateId: string) {
    const [row] = await db
        .select({
            id: deliveryPricingRates.id,
            townshipId: deliveryPricingRates.townshipId,
            merchantId: deliveryPricingRates.merchantId,
            isActive: deliveryPricingRates.isActive,
        })
        .from(deliveryPricingRates)
        .where(eq(deliveryPricingRates.id, rateId))
        .limit(1);

    return row ?? null;
}

export async function findConflictingActiveDeliveryPricingRate(input: {
    townshipId: string;
    merchantId: string | null;
    excludeRateId?: string;
}) {
    const filters = [
        eq(deliveryPricingRates.townshipId, input.townshipId),
        eq(deliveryPricingRates.isActive, true),
        input.merchantId
            ? eq(deliveryPricingRates.merchantId, input.merchantId)
            : isNull(deliveryPricingRates.merchantId),
    ];

    const [row] = await db
        .select({ id: deliveryPricingRates.id })
        .from(deliveryPricingRates)
        .where(
            and(
                ...filters,
                input.excludeRateId
                    ? sql`${deliveryPricingRates.id} <> ${input.excludeRateId}`
                    : undefined,
            ),
        )
        .limit(1);

    return row ?? null;
}

export async function createDeliveryPricingRate(input: DeliveryPricingRateInput) {
    const [created] = await db
        .insert(deliveryPricingRates)
        .values({
            townshipId: input.townshipId,
            merchantId: input.merchantId,
            baseWeightKg: toMoneyString(input.baseWeightKg),
            baseFee: toMoneyString(input.baseFee),
            extraWeightUnitKg: toMoneyString(input.extraWeightUnitKg),
            extraWeightFee: toMoneyString(input.extraWeightFee),
            volumetricDivisor: input.volumetricDivisor,
            codFeePercent: input.codFeePercent.toFixed(4),
            returnFeePercent: input.returnFeePercent.toFixed(4),
            isActive: input.isActive,
        })
        .returning({ id: deliveryPricingRates.id });

    return created;
}

export async function updateDeliveryPricingRate(input: UpdateDeliveryPricingRateInput) {
    await db
        .update(deliveryPricingRates)
        .set({
            townshipId: input.townshipId,
            merchantId: input.merchantId,
            baseWeightKg: toMoneyString(input.baseWeightKg),
            baseFee: toMoneyString(input.baseFee),
            extraWeightUnitKg: toMoneyString(input.extraWeightUnitKg),
            extraWeightFee: toMoneyString(input.extraWeightFee),
            volumetricDivisor: input.volumetricDivisor,
            codFeePercent: input.codFeePercent.toFixed(4),
            returnFeePercent: input.returnFeePercent.toFixed(4),
            isActive: input.isActive,
            updatedAt: new Date(),
        })
        .where(eq(deliveryPricingRates.id, input.rateId));
}

export async function deactivateDeliveryPricingRate(rateId: string) {
    await db
        .update(deliveryPricingRates)
        .set({
            isActive: false,
            updatedAt: new Date(),
        })
        .where(eq(deliveryPricingRates.id, rateId));
}

export async function findApplicableDeliveryPricingRate(input: {
    townshipId: string;
    merchantId: string | null;
}) {
    const merchantScopeOrder = sql<number>`
        case
            when ${deliveryPricingRates.merchantId} = ${input.merchantId} then 0
            else 1
        end
    `;
    const [row] = await db
        .select({
            id: deliveryPricingRates.id,
            townshipId: deliveryPricingRates.townshipId,
            merchantId: deliveryPricingRates.merchantId,
            baseWeightKg: deliveryPricingRates.baseWeightKg,
            baseFee: deliveryPricingRates.baseFee,
            extraWeightUnitKg: deliveryPricingRates.extraWeightUnitKg,
            extraWeightFee: deliveryPricingRates.extraWeightFee,
            volumetricDivisor: deliveryPricingRates.volumetricDivisor,
            codFeePercent: deliveryPricingRates.codFeePercent,
            returnFeePercent: deliveryPricingRates.returnFeePercent,
        })
        .from(deliveryPricingRates)
        .where(
            and(
                eq(deliveryPricingRates.townshipId, input.townshipId),
                eq(deliveryPricingRates.isActive, true),
                input.merchantId
                    ? sql`${deliveryPricingRates.merchantId} = ${input.merchantId} or ${deliveryPricingRates.merchantId} is null`
                    : isNull(deliveryPricingRates.merchantId),
            ),
        )
        .orderBy(merchantScopeOrder, desc(deliveryPricingRates.updatedAt))
        .limit(1);

    return row ?? null;
}

export async function quoteDeliveryPricing(
    input: DeliveryPricingQuoteInput,
): Promise<DeliveryPricingQuoteDto | null> {
    const rate = await findApplicableDeliveryPricingRate({
        townshipId: input.recipientTownshipId,
        merchantId: input.merchantId,
    });

    if (!rate) {
        return null;
    }

    const chargeableWeight = resolveChargeableWeightKg({
        estimatedWeightKg: input.estimatedWeightKg,
        isLargeItem: input.isLargeItem,
        packageWidthCm: input.packageWidthCm,
        packageHeightCm: input.packageHeightCm,
        packageLengthCm: input.packageLengthCm,
        volumetricDivisor: rate.volumetricDivisor,
    });
    const deliveryFee = calculateDeliveryFeeFromRate({
        chargeableWeightKg: chargeableWeight.chargeableWeightKg,
        baseWeightKg: Number(rate.baseWeightKg),
        baseFee: Number(rate.baseFee),
        extraWeightUnitKg: Number(rate.extraWeightUnitKg),
        extraWeightFee: Number(rate.extraWeightFee),
    });

    return toDeliveryPricingQuoteDto({
        rateId: rate.id,
        rateScope: rate.merchantId ? "merchant_specific" : "global",
        deliveryFee: toMoneyString(deliveryFee),
        chargeableWeightKg: toMoneyString(chargeableWeight.chargeableWeightKg),
        volumetricWeightKg:
            chargeableWeight.volumetricWeightKg === null
                ? null
                : toMoneyString(chargeableWeight.volumetricWeightKg),
        codFeePercent: rate.codFeePercent,
        returnFeePercent: rate.returnFeePercent,
    });
}
