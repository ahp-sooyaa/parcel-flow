"use client";

import { useEffect, useState } from "react";

import { ParcelListView } from "@/features/parcels/components/parcel-list-view";
import { useParcelRealtimeEvents } from "@/features/parcels/components/use-parcel-realtime-events";
import type { MerchantListItemDto } from "@/features/merchants/server/dto";
import type { ParcelListItemDto } from "@/features/parcels/server/dto";
import type { RiderListItemDto } from "@/features/riders/server/dto";
import type { TownshipListItemDto } from "@/features/townships/server/dto";
import type { UserRole } from "@/lib/domain";

export function RealtimeParcelListView(
  props: Readonly<{
    actorRole: UserRole;
    parcels: ParcelListItemDto[];
    merchants: MerchantListItemDto[];
    riders: RiderListItemDto[];
    townships: TownshipListItemDto[];
  }>,
) {
  const [liveParcels, setLiveParcels] = useState(props.parcels);

  useEffect(() => {
    setLiveParcels(props.parcels);
  }, [props.parcels]);

  useParcelRealtimeEvents({
    surface: "admin-list",
    onParcelUpsert(parcel) {
      setLiveParcels((current) => upsertParcel(current, parcel));
    },
    onParcelRemove(parcelId) {
      setLiveParcels((current) => current.filter((parcel) => parcel.id !== parcelId));
    },
  });

  return <ParcelListView {...props} parcels={liveParcels} />;
}

function upsertParcel(parcels: ParcelListItemDto[], nextParcel: ParcelListItemDto) {
  const existingIndex = parcels.findIndex((parcel) => parcel.id === nextParcel.id);

  if (existingIndex === -1) {
    return [...parcels, nextParcel];
  }

  return parcels.map((parcel) => (parcel.id === nextParcel.id ? nextParcel : parcel));
}
