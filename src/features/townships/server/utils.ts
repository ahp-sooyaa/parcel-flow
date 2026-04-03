import "server-only";
import { z } from "zod";

export const createTownshipSchema = z.object({
  name: z.string().trim().min(2).max(120),
  isActive: z.boolean(),
});

export function normalizeTownshipSearchQuery(raw: string | undefined) {
  return raw?.trim() ?? "";
}
