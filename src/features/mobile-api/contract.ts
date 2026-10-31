// Request and response shapes for the `/api/mobile/v1` API, shared with the
// Expo app in `mobile/`. Keep this file free of `@/` aliases and server-only
// imports (Next.js, the database, Better Auth) so it can be imported outside
// the Next.js server. See docs/mobile-app.md.
import { z } from "zod";

export const MOBILE_API_BASE_PATH = "/api/mobile/v1";

export const mobileErrorResponseSchema = z.object({
  ok: z.literal(false),
  message: z.string(),
});

export type MobileErrorResponse = z.infer<typeof mobileErrorResponseSchema>;

export function mobileSuccessResponseSchema<TData extends z.ZodType>(data: TData) {
  return z.object({
    ok: z.literal(true),
    message: z.string(),
    data,
  });
}

export type MobileSuccessResponse<TData> = {
  ok: true;
  message: string;
  data: TData;
};

export type MobileResponse<TData> = MobileSuccessResponse<TData> | MobileErrorResponse;

export const mobileMeSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
  phoneNumber: z.string(),
  role: z.literal("rider"),
  mustResetPassword: z.boolean(),
});

export type MobileMeDto = z.infer<typeof mobileMeSchema>;

export const mobileMeResponseSchema = mobileSuccessResponseSchema(mobileMeSchema);

// These lists mirror `parcelStatuses`, `parcelTypes` (src/lib/domain.ts) and
// `riderParcelTabs` (src/features/parcels/server/dto.ts). This file can't import
// them, so src/features/mobile-api/server/parcels.ts checks they stay equal.
export const mobileParcelStatuses = [
  "at_office",
  "on_the_way",
  "delivered",
  "postpone",
  "canceled_returned",
  "returned_to_merchant",
] as const;
export const mobileParcelTypes = ["cod", "non_cod"] as const;
export const mobileRiderParcelTabs = ["to_deliver", "delivered", "returned"] as const;

export const mobileParcelStatusSchema = z.enum(mobileParcelStatuses);
export const mobileParcelTypeSchema = z.enum(mobileParcelTypes);
export const mobileRiderParcelTabSchema = z.enum(mobileRiderParcelTabs);

export type MobileParcelStatus = z.infer<typeof mobileParcelStatusSchema>;
export type MobileRiderParcelTab = z.infer<typeof mobileRiderParcelTabSchema>;

export const mobileRiderParcelListItemSchema = z.object({
  id: z.string(),
  parcelCode: z.string(),
  status: mobileParcelStatusSchema,
  statusLabel: z.string(),
  receiverName: z.string(),
  receiverPhoneNumber: z.string(),
  receiverAddress: z.string(),
  townshipName: z.string(),
  // What the rider collects from the receiver, in whole MMK.
  amountToCollect: z.number().int(),
  hasActiveFailureNote: z.boolean(),
});

export type MobileRiderParcelListItemDto = z.infer<typeof mobileRiderParcelListItemSchema>;

export const mobileRiderParcelDetailSchema = mobileRiderParcelListItemSchema.extend({
  merchantName: z.string(),
  parcelType: mobileParcelTypeSchema,
  codAmount: z.number().int(),
  deliveryFee: z.number().int(),
  weightKg: z.number(),
  specialNotes: z.string().nullable(),
  activeFailureNote: z.string().nullable(),
  createdAt: z.string(),
});

export type MobileRiderParcelDetailDto = z.infer<typeof mobileRiderParcelDetailSchema>;

export const mobileRiderParcelPageSchema = z.object({
  parcels: z.array(mobileRiderParcelListItemSchema),
  page: z.number().int(),
  totalPages: z.number().int(),
  totalCount: z.number().int(),
  tabCounts: z.object({
    to_deliver: z.number().int(),
    delivered: z.number().int(),
    returned: z.number().int(),
  }),
});

export type MobileRiderParcelPageDto = z.infer<typeof mobileRiderParcelPageSchema>;

export const mobileRiderParcelPageResponseSchema = mobileSuccessResponseSchema(
  mobileRiderParcelPageSchema,
);
export const mobileRiderParcelDetailResponseSchema = mobileSuccessResponseSchema(
  mobileRiderParcelDetailSchema,
);

// Mirrors `startDeliveryInputSchema` (src/features/parcels/server/rider-operations.ts),
// which the server validates with; a unit test checks the two agree.
export const MOBILE_START_DELIVERY_MAX_PARCELS = 50;

export const mobileStartDeliveryRequestSchema = z.object({
  parcelIds: z.array(z.uuid()).min(1).max(MOBILE_START_DELIVERY_MAX_PARCELS),
});

export type MobileStartDeliveryRequest = z.infer<typeof mobileStartDeliveryRequestSchema>;

export const mobileStartDeliveryResultSchema = z.object({
  parcelIds: z.array(z.string()),
});

export type MobileStartDeliveryResultDto = z.infer<typeof mobileStartDeliveryResultSchema>;

export const mobileStartDeliveryResponseSchema = mobileSuccessResponseSchema(
  mobileStartDeliveryResultSchema,
);

// Mirror the server's proof photo rules (src/features/parcels/server/rider-operations.ts);
// a unit test checks they stay equal.
export const MOBILE_PROOF_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const mobileProofImageTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export const mobileMarkDeliveredResultSchema = z.object({
  parcelId: z.string(),
});

export type MobileMarkDeliveredResultDto = z.infer<typeof mobileMarkDeliveredResultSchema>;

export const mobileMarkDeliveredResponseSchema = mobileSuccessResponseSchema(
  mobileMarkDeliveredResultSchema,
);
