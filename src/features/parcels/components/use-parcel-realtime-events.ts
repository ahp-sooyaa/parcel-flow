"use client";

import { useEffect, useEffectEvent } from "react";

import type { ParcelListItemDto } from "@/features/parcels/server/dto";
import type { ParcelRealtimeSurface } from "@/features/parcels/server/realtime";

type ParcelUpsertEvent = {
  type: "parcel-upsert";
  parcel: ParcelListItemDto;
};

type ParcelRemoveEvent = {
  type: "parcel-remove";
  parcelId: string;
};

type StatsInvalidatedEvent = {
  type: "stats-invalidated";
  parcelId: string;
};

export function useParcelRealtimeEvents({
  surface,
  onParcelUpsert,
  onParcelRemove,
  onStatsInvalidated,
}: {
  surface: ParcelRealtimeSurface;
  onParcelUpsert?: (parcel: ParcelListItemDto) => void;
  onParcelRemove?: (parcelId: string) => void;
  onStatsInvalidated?: () => void;
}) {
  const handleParcelUpsert = useEffectEvent((event: MessageEvent<string>) => {
    if (!onParcelUpsert) {
      return;
    }

    const payload = parseParcelUpsertEvent(event.data);

    if (!payload) {
      return;
    }

    onParcelUpsert(payload.parcel);
  });

  const handleParcelRemove = useEffectEvent((event: MessageEvent<string>) => {
    if (!onParcelRemove) {
      return;
    }

    const payload = parseParcelRemoveEvent(event.data);

    if (!payload) {
      return;
    }

    onParcelRemove(payload.parcelId);
  });

  const handleStatsInvalidated = useEffectEvent((event: MessageEvent<string>) => {
    if (!onStatsInvalidated) {
      return;
    }

    if (!parseStatsInvalidatedEvent(event.data)) {
      return;
    }

    onStatsInvalidated();
  });

  useEffect(() => {
    if (typeof EventSource === "undefined") {
      return undefined;
    }

    const eventSource = new EventSource(`/api/realtime/parcels?surface=${surface}`);
    const onParcelUpsertEvent = (event: Event) => {
      if (event instanceof MessageEvent && typeof event.data === "string") {
        handleParcelUpsert(event);
      }
    };
    const onParcelRemoveEvent = (event: Event) => {
      if (event instanceof MessageEvent && typeof event.data === "string") {
        handleParcelRemove(event);
      }
    };
    const onStatsInvalidatedEvent = (event: Event) => {
      if (event instanceof MessageEvent && typeof event.data === "string") {
        handleStatsInvalidated(event);
      }
    };

    eventSource.addEventListener("parcel-upsert", onParcelUpsertEvent);
    eventSource.addEventListener("parcel-remove", onParcelRemoveEvent);
    eventSource.addEventListener("stats-invalidated", onStatsInvalidatedEvent);

    return () => {
      eventSource.close();
    };
  }, [surface]);
}

function parseParcelUpsertEvent(data: string): ParcelUpsertEvent | null {
  const payload = parseRealtimeEventPayload(data);

  if (payload?.type !== "parcel-upsert" || !isParcelListItemDto(payload.parcel)) {
    return null;
  }

  return {
    type: "parcel-upsert",
    parcel: payload.parcel,
  };
}

function parseParcelRemoveEvent(data: string): ParcelRemoveEvent | null {
  const payload = parseRealtimeEventPayload(data);

  if (payload?.type !== "parcel-remove" || typeof payload.parcelId !== "string") {
    return null;
  }

  return {
    type: "parcel-remove",
    parcelId: payload.parcelId,
  };
}

function parseStatsInvalidatedEvent(data: string): StatsInvalidatedEvent | null {
  const payload = parseRealtimeEventPayload(data);

  if (payload?.type !== "stats-invalidated" || typeof payload.parcelId !== "string") {
    return null;
  }

  return {
    type: "stats-invalidated",
    parcelId: payload.parcelId,
  };
}

function parseRealtimeEventPayload(data: string): Record<string, unknown> | null {
  const payload: unknown = JSON.parse(data);

  if (!payload || typeof payload !== "object") {
    return null;
  }

  return payload;
}

function isParcelListItemDto(value: unknown): value is ParcelListItemDto {
  if (!value || typeof value !== "object") {
    return false;
  }

  const parcel = value as Partial<ParcelListItemDto>;

  return (
    typeof parcel.id === "string" &&
    typeof parcel.parcelCode === "string" &&
    typeof parcel.merchantId === "string" &&
    typeof parcel.merchantName === "string" &&
    typeof parcel.receiverName === "string" &&
    typeof parcel.receiverPhoneNumber === "string" &&
    typeof parcel.receiverAddress === "string" &&
    typeof parcel.townshipId === "string" &&
    typeof parcel.townshipName === "string" &&
    (parcel.parcelType === "cod" || parcel.parcelType === "non_cod") &&
    typeof parcel.codAmount === "number" &&
    typeof parcel.deliveryFee === "number" &&
    typeof parcel.weightKg === "number" &&
    Array.isArray(parcel.failureNotes) &&
    Array.isArray(parcel.proofOfDeliveryImagesKeys) &&
    typeof parcel.status === "string" &&
    typeof parcel.hasUnresolvedFailureReview === "boolean" &&
    typeof parcel.createdAt === "string"
  );
}
