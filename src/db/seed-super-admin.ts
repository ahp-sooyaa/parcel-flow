import { eq } from "drizzle-orm";

import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { buildInternalEmail, normalizePhoneNumber } from "@/features/users/server/utils";
import { auth } from "@/lib/auth";

const username = getRequiredEnv("FIRST_SUPER_ADMIN_USERNAME").toLowerCase();
const password = getRequiredEnv("FIRST_SUPER_ADMIN_PASSWORD");
const displayName = process.env.FIRST_SUPER_ADMIN_NAME?.trim() || "Super Admin";
const phoneNumber = normalizePhoneNumber(
  process.env.FIRST_SUPER_ADMIN_PHONE_NUMBER?.trim() || "09000000000",
);
const address = process.env.FIRST_SUPER_ADMIN_ADDRESS?.trim() || "";
const age = parseOptionalAge(process.env.FIRST_SUPER_ADMIN_AGE);
const email = buildInternalEmail(username);

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function parseOptionalAge(value: string | undefined) {
  if (!value?.trim()) {
    return undefined;
  }

  const parsedAge = Number(value);

  if (!Number.isInteger(parsedAge) || parsedAge < 1) {
    throw new Error("FIRST_SUPER_ADMIN_AGE must be a positive integer when provided.");
  }

  return parsedAge;
}

async function main() {
  const [existingUser] = await db
    .select({ id: appUsers.id, username: appUsers.username, role: appUsers.role })
    .from(appUsers)
    .where(eq(appUsers.username, username))
    .limit(1);

  if (existingUser) {
    if (existingUser.role !== "super_admin") {
      throw new Error(
        `User "${username}" already exists with role "${existingUser.role}". Refusing to overwrite it.`,
      );
    }

    console.log(`Super admin "${username}" already exists. No changes made.`);
    return;
  }

  const createdUser = await auth.api.createUser({
    body: {
      name: displayName,
      email,
      password,
      role: "super_admin",
      data: {
        username,
        displayUsername: username,
        phoneNumber,
        address,
        age,
        isActive: true,
        mustResetPassword: false,
      },
    },
  });

  console.log(`Created first super admin "${username}" with id ${createdUser.user.id}.`);
}

await main();
process.exit(0);
