import "server-only";
import { z } from "zod";

const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
});

const supabaseKeySchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a URL"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
});

const supabaseAdminSchema = supabaseKeySchema.extend({
  SUPABASE_SECRET_KEY: z.string().min(1, "SUPABASE_SECRET_KEY is required"),
});

const superAdminSeedSchema = z.object({
  SUPER_ADMIN_EMAIL: z.string().email().optional(),
  SUPER_ADMIN_FULL_NAME: z.string().min(1).optional(),
  SUPER_ADMIN_PHONE_NUMBER: z.string().min(1).optional(),
});

const safeEnvSchema = superAdminSeedSchema.partial();

export function getDatabaseUrlEnv() {
  return databaseEnvSchema.parse(process.env);
}

export function getSupabasePublicEnv() {
  const env = supabaseKeySchema.parse(process.env);
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!publishableKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required");
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  };
}

export function getSupabaseAdminEnv() {
  const env = supabaseAdminSchema.parse(process.env);
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!publishableKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required");
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    SUPABASE_SECRET_KEY: env.SUPABASE_SECRET_KEY,
  };
}

export function getSafeEnv() {
  return safeEnvSchema.parse(process.env);
}
