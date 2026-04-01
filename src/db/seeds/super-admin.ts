import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { appUsers, roles } from "@/db/schema";

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function createSeedDbClient() {
  const databaseUrl = requiredEnv("DATABASE_URL");
  const queryClient = postgres(databaseUrl, {
    max: 1,
    prepare: false,
  });

  return drizzle(queryClient, { schema: { appUsers, roles }, casing: "snake_case" });
}

function createSeedSupabaseAdminClient() {
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SECRET_KEY is required");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function generateStrongPassword(length: number) {
  if (length < 12) {
    throw new Error("Temporary password length must be at least 12.");
  }

  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+";
  const bytes = randomBytes(length * 2);
  let password = "";

  for (let i = 0; i < bytes.length && password.length < length; i += 1) {
    password += charset[bytes[i] % charset.length];
  }

  return password.slice(0, length);
}

export async function seedSuperAdmin() {
  const db = createSeedDbClient();
  const superAdminEmail = requiredEnv("SUPER_ADMIN_EMAIL");
  const superAdminFullName = requiredEnv("SUPER_ADMIN_FULL_NAME");
  const superAdminPhoneNumber = process.env.SUPER_ADMIN_PHONE_NUMBER ?? null;

  const [superAdminRole] = await db
    .select()
    .from(roles)
    .where(eq(roles.slug, "super_admin"))
    .limit(1);

  if (!superAdminRole) {
    throw new Error("Super admin role must exist before user seed.");
  }

  const supabaseAdmin = createSeedSupabaseAdminClient();
  const temporaryPassword = generateStrongPassword(24);

  const listedUsers = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 100,
  });

  const existing = listedUsers.data.users.find((user) => user.email === superAdminEmail);

  const supabaseUser =
    existing ??
    (
      await supabaseAdmin.auth.admin.createUser({
        email: superAdminEmail,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          full_name: superAdminFullName,
        },
      })
    ).data.user;

  if (!supabaseUser) {
    throw new Error("Unable to resolve super admin user in Supabase Auth");
  }

  const [existingAppUser] = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.supabaseUserId, supabaseUser.id))
    .limit(1);

  if (!existingAppUser) {
    await db.insert(appUsers).values({
      supabaseUserId: supabaseUser.id,
      fullName: superAdminFullName,
      email: superAdminEmail,
      phoneNumber: superAdminPhoneNumber,
      roleId: superAdminRole.id,
      isActive: true,
      mustResetPassword: true,
    });
  }

  return {
    email: superAdminEmail,
    temporaryPassword: existing ? undefined : temporaryPassword,
  };
}
