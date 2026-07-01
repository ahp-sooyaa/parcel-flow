import { eq } from "drizzle-orm";

import { db } from "@/db";
import { merchants, riders } from "@/db/schema";
import {
  getParcelByIdForRealtimeListScope,
  type ParcelRealtimeViewerScope,
} from "@/features/parcels/server/dal";
import type { ParcelListItemDto } from "@/features/parcels/server/dto";
import type { UserRole } from "@/lib/domain";
import type { CurrentUser } from "@/lib/session";

export const parcelRealtimeSurfaces = [
  "admin-list",
  "admin-summary",
  "merchant-list",
  "merchant-summary",
  "rider-list",
] as const;

export type ParcelRealtimeSurface = (typeof parcelRealtimeSurfaces)[number];

export type ParcelRealtimeRow = {
  id: string;
  merchant_id: string;
  rider_id: string | null;
  status: string;
  cod_amount: number;
  delivery_fee: number;
  parcel_type: string;
  is_received_by_office: boolean;
  deleted_at: string | null;
};

export type ParcelRealtimeStreamEvent =
  | { type: "parcel-upsert"; parcel: ParcelListItemDto }
  | { type: "parcel-remove"; parcelId: string }
  | { type: "stats-invalidated"; parcelId: string };

type BaseScopeContext = {
  userId: string;
  role: UserRole;
};

type AdminScopeContext = BaseScopeContext & {
  role: "super_admin" | "office_admin";
};

type MerchantScopeContext = BaseScopeContext & {
  role: "merchant";
  merchantId: string;
};

type RiderScopeContext = BaseScopeContext & {
  role: "rider";
  riderId: string;
};

export type ParcelRealtimeScopeContext =
  | AdminScopeContext
  | MerchantScopeContext
  | RiderScopeContext;

export async function loadParcelRealtimeScopeContext(
  user: CurrentUser,
): Promise<ParcelRealtimeScopeContext> {
  if (user.role === "super_admin" || user.role === "office_admin") {
    return {
      role: user.role,
      userId: user.id,
    };
  }

  if (user.role === "merchant") {
    const [merchant] = await db
      .select({ id: merchants.id })
      .from(merchants)
      .where(eq(merchants.userId, user.id))
      .limit(1);

    if (!merchant) {
      throw new Error("Merchant profile was not found.");
    }

    return {
      role: "merchant",
      userId: user.id,
      merchantId: merchant.id,
    };
  }

  const [rider] = await db
    .select({ id: riders.id })
    .from(riders)
    .where(eq(riders.userId, user.id))
    .limit(1);

  if (!rider) {
    throw new Error("Rider profile was not found.");
  }

  return {
    role: "rider",
    userId: user.id,
    riderId: rider.id,
  };
}

export function isParcelRealtimeSurface(value: string): value is ParcelRealtimeSurface {
  return parcelRealtimeSurfaces.some((surface) => surface === value);
}

export function isParcelVisibleToRealtimeScope(
  row: ParcelRealtimeRow | null | undefined,
  scope: ParcelRealtimeScopeContext,
) {
  if (!row || row.deleted_at !== null) {
    return false;
  }

  if (scope.role === "merchant") {
    return row.merchant_id === scope.merchantId;
  }

  if (scope.role === "rider") {
    return row.rider_id === scope.riderId;
  }

  return true;
}

export async function buildParcelRealtimeEventForScope(input: {
  scope: ParcelRealtimeScopeContext;
  surface: ParcelRealtimeSurface;
  nextRow: ParcelRealtimeRow | null;
  previousRow: ParcelRealtimeRow | null;
}): Promise<ParcelRealtimeStreamEvent | null> {
  const { nextRow, previousRow, scope, surface } = input;

  if (surface === "admin-summary" || surface === "merchant-summary") {
    const parcelId = nextRow?.id ?? previousRow?.id;

    if (!parcelId || !shouldInvalidateStats(nextRow, previousRow, surface, scope)) {
      return null;
    }

    return {
      type: "stats-invalidated",
      parcelId,
    };
  }

  const isVisibleNow = isParcelVisibleToRealtimeScope(nextRow, scope);
  const wasVisibleBefore = isParcelVisibleToRealtimeScope(previousRow, scope);
  const parcelId = nextRow?.id ?? previousRow?.id;

  if (!parcelId) {
    return null;
  }

  if (!isVisibleNow && !wasVisibleBefore) {
    return null;
  }

  if (!isVisibleNow && wasVisibleBefore) {
    return {
      type: "parcel-remove",
      parcelId,
    };
  }

  const parcel = await getParcelByIdForRealtimeListScope(parcelId, toViewerScope(scope));

  if (!parcel) {
    return wasVisibleBefore
      ? {
          type: "parcel-remove",
          parcelId,
        }
      : null;
  }

  return {
    type: "parcel-upsert",
    parcel,
  };
}

function toViewerScope(scope: ParcelRealtimeScopeContext): ParcelRealtimeViewerScope {
  if (scope.role === "super_admin" || scope.role === "office_admin") {
    return { role: scope.role };
  }

  if (scope.role === "merchant") {
    return { role: "merchant", userId: scope.userId };
  }

  return { role: "rider", userId: scope.userId };
}

function shouldInvalidateStats(
  nextRow: ParcelRealtimeRow | null,
  previousRow: ParcelRealtimeRow | null,
  surface: ParcelRealtimeSurface,
  scope: ParcelRealtimeScopeContext,
) {
  const isRelevantNow = isParcelVisibleToRealtimeScope(nextRow, scope);
  const wasRelevantBefore = isParcelVisibleToRealtimeScope(previousRow, scope);

  if (!isRelevantNow && !wasRelevantBefore) {
    return false;
  }

  const trackedFields: Array<keyof ParcelRealtimeRow> =
    surface === "admin-summary"
      ? ["status", "rider_id", "cod_amount", "delivery_fee", "parcel_type", "deleted_at"]
      : [
          "status",
          "cod_amount",
          "delivery_fee",
          "parcel_type",
          "is_received_by_office",
          "deleted_at",
        ];

  return trackedFields.some(
    (field) => (nextRow?.[field] ?? null) !== (previousRow?.[field] ?? null),
  );
}
