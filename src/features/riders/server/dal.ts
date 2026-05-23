import { eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import { appUsers, parcels, riders, riderServiceTownships, townships } from "@/db/schema";
import type { RiderListItemDto } from "@/features/riders/server/dto";
import {
  calculateAmountToCollect,
  isActiveCollectionStatus,
} from "@/features/parcels/server/utils";

export async function listRiders(): Promise<RiderListItemDto[]> {
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

  const [serviceTownshipRows, parcelRows] =
    riderIds.length > 0
      ? await Promise.all([
          db
            .select({
              riderId: riderServiceTownships.riderId,
              townshipName: townships.name,
            })
            .from(riderServiceTownships)
            .innerJoin(townships, eq(townships.id, riderServiceTownships.townshipId))
            .where(inArray(riderServiceTownships.riderId, riderIds)),
          db
            .select({
              riderId: parcels.riderId,
              codAmount: parcels.codAmount,
              deliveryFee: parcels.deliveryFee,
              parcelType: parcels.parcelType,
              collectedAmount: parcels.collectedAmount,
              status: parcels.status,
            })
            .from(parcels)
            .where(isNull(parcels.deletedAt)),
        ])
      : [[], []];

  return rows.map((rider) => {
    const assignedParcels = parcelRows.filter((parcel) => parcel.riderId === rider.id);

    return {
      ...rider,
      serviceTownships: serviceTownshipRows
        .filter((serviceTownship) => serviceTownship.riderId === rider.id)
        .map((serviceTownship) => serviceTownship.townshipName),
      expectedCollection: assignedParcels
        .filter((parcel) => isActiveCollectionStatus(parcel.status))
        .reduce(
          (total, parcel) =>
            total +
            calculateAmountToCollect({
              codAmount: parcel.codAmount,
              deliveryFee: parcel.deliveryFee,
              parcelType: parcel.parcelType === "non_cod" ? "non_cod" : "cod",
            }),
          0,
        ),
      actualCollection: assignedParcels
        .filter((parcel) => parcel.status === "delivered")
        .reduce((total, parcel) => total + parcel.collectedAmount, 0),
      activeParcelCount: assignedParcels.filter((parcel) => isActiveCollectionStatus(parcel.status))
        .length,
    };
  });
}
