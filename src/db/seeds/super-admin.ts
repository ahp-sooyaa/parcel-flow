import { eq } from "drizzle-orm";
import { getRoleBySlug, seedAuthFoundation } from "./auth-foundation";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { getSafeEnv } from "@/lib/env";
import { generateStrongPassword } from "@/lib/security/password";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function seedSuperAdmin() {
  await seedAuthFoundation();

  const env = getSafeEnv();

  if (!env.SUPER_ADMIN_EMAIL || !env.SUPER_ADMIN_FULL_NAME) {
    throw new Error(
      "SUPER_ADMIN_EMAIL and SUPER_ADMIN_FULL_NAME are required for super admin seeding.",
    );
  }

  const superAdminRole = await getRoleBySlug("super_admin");

  if (!superAdminRole) {
    throw new Error("Super admin role must exist before user seed.");
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const temporaryPassword = generateStrongPassword(24);

  const listedUsers = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 100,
  });

  const existing = listedUsers.data.users.find((user) => user.email === env.SUPER_ADMIN_EMAIL);

  const supabaseUser = existing
    ? existing
    : (
        await supabaseAdmin.auth.admin.createUser({
          email: env.SUPER_ADMIN_EMAIL,
          password: temporaryPassword,
          email_confirm: true,
          user_metadata: {
            full_name: env.SUPER_ADMIN_FULL_NAME,
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
      fullName: env.SUPER_ADMIN_FULL_NAME,
      email: env.SUPER_ADMIN_EMAIL,
      phoneNumber: env.SUPER_ADMIN_PHONE_NUMBER ?? null,
      roleId: superAdminRole.id,
      isActive: true,
      mustResetPassword: true,
    });
  }

  return {
    email: env.SUPER_ADMIN_EMAIL,
    temporaryPassword: existing ? undefined : temporaryPassword,
  };
}
