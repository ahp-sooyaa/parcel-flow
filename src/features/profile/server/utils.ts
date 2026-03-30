import "server-only";
import { z } from "zod";

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phoneNumber: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((value) => (value ? value : null)),
});

export const changePasswordSchema = z
  .object({
    password: z.string().min(12),
    confirmPassword: z.string().min(12),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });
