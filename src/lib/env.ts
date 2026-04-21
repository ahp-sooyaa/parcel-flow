import "server-only";
import { z } from "zod";

const databaseEnvSchema = z.object({
    DATABASE_URL: z.string().min(1),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(10).optional(),
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
const r2EnvSchema = z.object({
    CLOUDFLARE_R2_ACCOUNT_ID: z.string().min(1),
    CLOUDFLARE_R2_ACCESS_KEY_ID: z.string().min(1),
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: z.string().min(1),
    CLOUDFLARE_R2_BUCKET: z.string().min(1),
});

export function getDatabaseUrlEnv() {
    const env = databaseEnvSchema.parse(process.env);

    return {
        DATABASE_URL: env.DATABASE_URL,
        DATABASE_POOL_MAX: env.DATABASE_POOL_MAX ?? (process.env.NODE_ENV === "production" ? 1 : 5),
    };
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

export function getR2Env() {
    return r2EnvSchema.parse(process.env);
}
