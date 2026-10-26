import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, username } from "better-auth/plugins";
import { adminAc, userAc } from "better-auth/plugins/admin/access";

import { db } from "@/db";

function getAuthSecret() {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();

  if (secret) {
    return secret;
  }

  // The fallback is public in the repo, so a running production server must
  // never sign sessions with it. `next build` imports this module without
  // runtime secrets, so only enforce it outside the build phase.
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    throw new Error("BETTER_AUTH_SECRET must be set in production.");
  }

  return "parcel-flow-development-secret-please-replace-before-production";
}

export const auth = betterAuth({
  appName: "Parcel Flow",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: getAuthSecret(),
  rateLimit: {
    enabled: process.env.NODE_ENV === "production",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/username": { window: 60, max: 10 },
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  user: {
    additionalFields: {
      phoneNumber: {
        type: "string",
        required: true,
      },
      address: {
        type: "string",
        required: true,
        defaultValue: "",
      },
      age: {
        type: "number",
        required: false,
      },
      isActive: {
        type: "boolean",
        required: true,
        defaultValue: true,
      },
      mustResetPassword: {
        type: "boolean",
        required: true,
        defaultValue: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  plugins: [
    nextCookies(),
    username({
      minUsernameLength: 3,
      usernameValidator: (value) => /^[a-z0-9-]+$/.test(value),
    }),
    admin({
      defaultRole: "merchant",
      adminRoles: ["super_admin", "office_admin"],
      roles: {
        super_admin: adminAc,
        office_admin: adminAc,
        merchant: userAc,
        rider: userAc,
      },
    }),
  ],
});
