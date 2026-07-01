"use client";

import { useEffect, useState } from "react";

import { ParcelListView } from "@/features/parcels/components/parcel-list-view";
import { useParcelRealtimeEvents } from "@/features/parcels/components/use-parcel-realtime-events";
import type { MerchantOptionDto } from "@/features/merchants/server/dto";
import {
  parcelMatchesAdminListFilters,
  type AdminParcelListFiltersDto,
  type AdminParcelListPageDto,
  type ParcelListItemDto,
} from "@/features/parcels/server/dto";
import type { RiderOptionDto } from "@/features/riders/server/dto";
import type { TownshipListItemDto } from "@/features/townships/server/dto";
import type { UserRole } from "@/lib/domain";

export function RealtimeParcelListView(
  props: Readonly<{
    actorRole: UserRole;
    pageResult: AdminParcelListPageDto;
    filters: AdminParcelListFiltersDto;
    merchants: MerchantOptionDto[];
    riders: RiderOptionDto[];
    townships: TownshipListItemDto[];
  }>,
) {
  const [liveParcels, setLiveParcels] = useState(props.pageResult.parcels);

  useEffect(() => {
    setLiveParcels(props.pageResult.parcels);
  }, [props.pageResult.parcels]);

  useParcelRealtimeEvents({
    surface: "admin-list",
    onParcelUpsert(parcel) {
      setLiveParcels((current) => upsertParcel(current, parcel, props.filters));
    },
    onParcelRemove(parcelId) {
      setLiveParcels((current) => current.filter((parcel) => parcel.id !== parcelId));
    },
  });

  return <ParcelListView {...props} pageResult={{ ...props.pageResult, parcels: liveParcels }} />;
}

function upsertParcel(
  parcels: ParcelListItemDto[],
  nextParcel: ParcelListItemDto,
  filters: AdminParcelListFiltersDto,
) {
  const existingIndex = parcels.findIndex((parcel) => parcel.id === nextParcel.id);
  const matchesFilters = parcelMatchesAdminListFilters(nextParcel, filters);

  if (!matchesFilters) {
    if (existingIndex === -1) {
      return parcels;
    }

    return parcels.filter((parcel) => parcel.id !== nextParcel.id);
  }

  if (existingIndex === -1) {
    return [...parcels, nextParcel];
  }

  return parcels.map((parcel) => (parcel.id === nextParcel.id ? nextParcel : parcel));
}
