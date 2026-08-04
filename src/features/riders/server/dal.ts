import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/db";
import { appUsers, parcels, riders, riderServiceTownships, townships } from "@/db/schema";
import type { RiderListItemDto, RiderOptionDto } from "@/features/riders/server/dto";
import { CACHE_TAGS } from "@/lib/cache-tags";

const riderParcelAggregationSelect = {
  riderId: parcels.riderId,
  activeParcelCount: sql<number>`count(*) filter (where ${parcels.status} in ('at_office', 'on_the_way'))`,
  expectedCollection: sql<number>`coalesce(sum(
    case
      when ${parcels.status} in ('at_office', 'on_the_way') then
        case when ${parcels.parcelType} = 'cod' then ${parcels.codAmount} + ${parcels.deliveryFee} else ${parcels.deliveryFee} end
      else 0
    end
  ), 0)`,
  actualCollection: sql<number>`coalesce(sum(${parcels.collectedAmount}) filter (where ${parcels.status} = 'delivered'), 0)`,
};

async function loadRiderParcelAggregations(riderIds: string[]) {
  if (riderIds.length === 0) {
    return new Map<
      string,
      { activeParcelCount: number; expectedCollection: number; actualCollection: number }
    >();
  }

  const aggregationRows = await db
    .select(riderParcelAggregationSelect)
    .from(parcels)
    .where(
      and(
        isNull(parcels.deletedAt),
        isNotNull(parcels.riderId),
        inArray(parcels.riderId, riderIds),
      ),
    )
    .groupBy(parcels.riderId);

  return new Map(
    aggregationRows
      .filter((row): row is typeof row & { riderId: string } => row.riderId !== null)
      .map((row) => [
        row.riderId,
        {
          activeParcelCount: row.activeParcelCount,
          expectedCollection: row.expectedCollection,
          actualCollection: row.actualCollection,
        },
      ]),
  );
}

async function loadRiderServiceTownships(riderIds: string[]) {
  if (riderIds.length === 0) {
    return new Map<string, string[]>();
  }

  const serviceTownshipRows = await db
    .select({
      riderId: riderServiceTownships.riderId,
      townshipName: townships.name,
    })
    .from(riderServiceTownships)
    .innerJoin(townships, eq(townships.id, riderServiceTownships.townshipId))
    .where(inArray(riderServiceTownships.riderId, riderIds));

  const serviceTownshipsByRiderId = new Map<string, string[]>();

  for (const row of serviceTownshipRows) {
    const townshipsForRider = serviceTownshipsByRiderId.get(row.riderId) ?? [];
    townshipsForRider.push(row.townshipName);
    serviceTownshipsByRiderId.set(row.riderId, townshipsForRider);
  }

  return serviceTownshipsByRiderId;
}

export async function listRiders(): Promise<RiderListItemDto[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.riders, CACHE_TAGS.parcels);

  const rows = await db
    .select({
      id: riders.id,
      name: appUsers.name,
      phoneNumber: appUsers.phoneNumber,
    })
    .from(riders)
    .innerJoin(appUsers, eq(appUsers.id, riders.userId))
    .where(isNull(appUsers.deletedAt));

  const riderIds = rows.map((rider) => rider.id);
  const [aggregationsByRiderId, serviceTownshipsByRiderId] = await Promise.all([
    loadRiderParcelAggregations(riderIds),
    loadRiderServiceTownships(riderIds),
  ]);

  return rows.map((rider) => {
    const aggregation = aggregationsByRiderId.get(rider.id);

    return {
      ...rider,
      serviceTownships: serviceTownshipsByRiderId.get(rider.id) ?? [],
      expectedCollection: aggregation?.expectedCollection ?? 0,
      actualCollection: aggregation?.actualCollection ?? 0,
      activeParcelCount: aggregation?.activeParcelCount ?? 0,
    };
  });
}

export async function listRiderOptions(): Promise<RiderOptionDto[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.riderOptions, CACHE_TAGS.riders, CACHE_TAGS.parcels);

  const rows = await db
    .select({
      id: riders.id,
      name: appUsers.name,
      phoneNumber: appUsers.phoneNumber,
    })
    .from(riders)
    .innerJoin(appUsers, eq(appUsers.id, riders.userId))
    .where(isNull(appUsers.deletedAt));

  const riderIds = rows.map((rider) => rider.id);
  const [aggregationsByRiderId, serviceTownshipsByRiderId] = await Promise.all([
    loadRiderParcelAggregations(riderIds),
    loadRiderServiceTownships(riderIds),
  ]);

  return rows.map((rider) => ({
    id: rider.id,
    name: rider.name,
    phoneNumber: rider.phoneNumber,
    serviceTownships: serviceTownshipsByRiderId.get(rider.id) ?? [],
    expectedCollection: aggregationsByRiderId.get(rider.id)?.expectedCollection ?? 0,
  }));
}
