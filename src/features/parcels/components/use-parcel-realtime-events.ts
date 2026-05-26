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

  if (payload?.type !== "parcel-upsert" || !("parcel" in payload)) {
    return null;
  }

  return payload as ParcelUpsertEvent;
}

function parseParcelRemoveEvent(data: string): ParcelRemoveEvent | null {
  const payload = parseRealtimeEventPayload(data);

  if (payload?.type !== "parcel-remove" || typeof payload.parcelId !== "string") {
    return null;
  }

  return payload as ParcelRemoveEvent;
}

function parseStatsInvalidatedEvent(data: string): StatsInvalidatedEvent | null {
  const payload = parseRealtimeEventPayload(data);

  if (payload?.type !== "stats-invalidated" || typeof payload.parcelId !== "string") {
    return null;
  }

  return payload as StatsInvalidatedEvent;
}

function parseRealtimeEventPayload(data: string): Record<string, unknown> | null {
  const payload: unknown = JSON.parse(data);

  if (!payload || typeof payload !== "object") {
    return null;
  }

  return payload as Record<string, unknown>;
}
