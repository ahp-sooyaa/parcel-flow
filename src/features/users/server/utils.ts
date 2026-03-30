import "server-only";
import { z } from "zod";
import { ROLE_SLUGS } from "@/db/constants";

export const createUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phoneNumber: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((value) => (value ? value : null)),
  role: z.enum(ROLE_SLUGS),
  isActive: z.boolean(),
});

export function parseActiveFlag(raw: FormDataEntryValue | null) {
  return raw === "on" || raw === "true";
}
