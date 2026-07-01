"use client";

import { useEffect, useState } from "react";

import { RiderParcelCardList } from "@/features/parcels/components/rider-parcel-card-list";
import { useParcelRealtimeEvents } from "@/features/parcels/components/use-parcel-realtime-events";
import type {
  ParcelListItemDto,
  RiderParcelListFiltersDto,
  RiderParcelListPageDto,
} from "@/features/parcels/server/dto";
import type { TownshipListItemDto } from "@/features/townships/server/dto";

export function RealtimeRiderParcelCardList(
  props: Readonly<{
    pageResult: RiderParcelListPageDto;
    filters: RiderParcelListFiltersDto;
    townships: TownshipListItemDto[];
  }>,
) {
  const [liveParcels, setLiveParcels] = useState(props.pageResult.parcels);

  useEffect(() => {
    setLiveParcels(props.pageResult.parcels);
  }, [props.pageResult.parcels]);

  useParcelRealtimeEvents({
    surface: "rider-list",
    onParcelUpsert(parcel) {
      setLiveParcels((current) => upsertParcel(current, parcel));
    },
    onParcelRemove(parcelId) {
      setLiveParcels((current) => current.filter((parcel) => parcel.id !== parcelId));
    },
  });

  return (
    <RiderParcelCardList {...props} pageResult={{ ...props.pageResult, parcels: liveParcels }} />
  );
}

function upsertParcel(parcels: ParcelListItemDto[], nextParcel: ParcelListItemDto) {
  const existingIndex = parcels.findIndex((parcel) => parcel.id === nextParcel.id);

  if (existingIndex === -1) {
    return [...parcels, nextParcel];
  }

  return parcels.map((parcel) => (parcel.id === nextParcel.id ? nextParcel : parcel));
}
