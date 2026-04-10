import "server-only";
import { z } from "zod";

import type { AppAccessContext } from "@/features/auth/server/dto";

export const createTownshipSchema = z.object({
  name: z.string().trim().min(2).max(120),
  isActive: z.boolean(),
});

export function normalizeTownshipSearchQuery(raw: string | undefined) {
  return raw?.trim() ?? "";
}

export function getTownshipResourceAccess(input: {
  viewer: Pick<AppAccessContext, "permissions">;
}) {
  const { viewer } = input;

  return {
    canViewList: viewer.permissions.includes("township-list.view"),
    canCreate: viewer.permissions.includes("township.create"),
  };
}
