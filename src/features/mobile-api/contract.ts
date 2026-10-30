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
