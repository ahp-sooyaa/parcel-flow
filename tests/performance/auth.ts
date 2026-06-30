import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";

import { accounts, appUsers } from "@/db/schema";
import { buildInternalEmail, normalizePhoneNumber } from "@/features/users/server/utils";
import { auth } from "@/lib/auth";
import type { UserRole } from "@/lib/domain";

import type { createTestDatabase } from "../fixtures/db";

type TestDb = ReturnType<typeof createTestDatabase>["db"];

export const perfUserPassword = "password123";

type PerfAuthUserConfig = {
  username: string;
  name: string;
  role: UserRole;
  phoneNumber: string;
  address: string;
};

export async function seedPerfAuthUser(db: TestDb, config: PerfAuthUserConfig) {
  const [existingUser] = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.username, config.username))
    .limit(1);

  if (existingUser) {
    await db
      .update(appUsers)
      .set({
        name: config.name,
        email: buildInternalEmail(config.username),
        phoneNumber: normalizePhoneNumber(config.phoneNumber),
        address: config.address,
        role: config.role,
        isActive: true,
        mustResetPassword: false,
        updatedAt: new Date(),
      })
      .where(eq(appUsers.id, existingUser.id));

    await upsertCredentialPassword(db, existingUser.id, perfUserPassword);

    return existingUser;
  }

  const createdUser = await auth.api.createUser({
    body: {
      name: config.name,
      email: buildInternalEmail(config.username),
      password: perfUserPassword,
      role: config.role,
      data: {
        username: config.username,
        displayUsername: config.username,
        phoneNumber: normalizePhoneNumber(config.phoneNumber),
        address: config.address,
        age: null,
        isActive: true,
        mustResetPassword: false,
      },
    },
  });

  const [user] = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.id, createdUser.user.id))
    .limit(1);

  if (!user) {
    throw new Error(`Created perf user "${config.username}" could not be loaded.`);
  }

  return user;
}

async function upsertCredentialPassword(db: TestDb, userId: string, password: string) {
  const passwordHash = await hashPassword(password);
  const [existingAccount] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")))
    .limit(1);

  if (existingAccount) {
    await db
      .update(accounts)
      .set({
        accountId: userId,
        password: passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, existingAccount.id));

    return;
  }

  await db.insert(accounts).values({
    accountId: userId,
    providerId: "credential",
    userId,
    password: passwordHash,
  });
}
