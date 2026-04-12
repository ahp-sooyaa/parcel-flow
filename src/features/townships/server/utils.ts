import "server-only";
import { z } from "zod";

import type { AppAccessContext } from "@/features/auth/server/dto";

const checkboxBoolean = z.preprocess((value) => value === "on" || value === "true", z.boolean());

export const createTownshipSchema = z.object({
  name: z.string().trim().min(2).max(120),
  isActive: checkboxBoolean,
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
