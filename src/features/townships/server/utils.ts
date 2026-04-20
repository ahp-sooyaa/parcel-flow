import "server-only";
import { z } from "zod";

const checkboxBoolean = z.preprocess((value) => value === "on" || value === "true", z.boolean());

export const createTownshipSchema = z.object({
    name: z.string().trim().min(2).max(120),
    isActive: checkboxBoolean,
});

export function normalizeTownshipSearchQuery(raw: string | undefined) {
    return raw?.trim() ?? "";
}
