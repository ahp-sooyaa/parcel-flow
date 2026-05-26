"use client";

import { useEffect, useState } from "react";

import { RiderParcelCardList } from "@/features/parcels/components/rider-parcel-card-list";
import { useParcelRealtimeEvents } from "@/features/parcels/components/use-parcel-realtime-events";
import type { ParcelListItemDto } from "@/features/parcels/server/dto";

export function RealtimeRiderParcelCardList({
  parcels,
}: Readonly<{
  parcels: ParcelListItemDto[];
}>) {
  const [liveParcels, setLiveParcels] = useState(parcels);

  useEffect(() => {
    setLiveParcels(parcels);
  }, [parcels]);

  useParcelRealtimeEvents({
    surface: "rider-list",
    onParcelUpsert(parcel) {
      setLiveParcels((current) => upsertParcel(current, parcel));
    },
    onParcelRemove(parcelId) {
      setLiveParcels((current) => current.filter((parcel) => parcel.id !== parcelId));
    },
  });

  return <RiderParcelCardList parcels={liveParcels} />;
}

function upsertParcel(parcels: ParcelListItemDto[], nextParcel: ParcelListItemDto) {
  const existingIndex = parcels.findIndex((parcel) => parcel.id === nextParcel.id);

  if (existingIndex === -1) {
    return [...parcels, nextParcel];
  }

  return parcels.map((parcel) => (parcel.id === nextParcel.id ? nextParcel : parcel));
}
