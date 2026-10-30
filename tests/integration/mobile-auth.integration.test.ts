import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";
import { hashPassword } from "better-auth/crypto";

import { accounts } from "@/db/schema";
import { mobileMeResponseSchema } from "@/features/mobile-api/contract";
import type { UserRole } from "@/lib/domain";
import { cleanupTestRecords } from "../fixtures/cleanup";
import { closeTestDatabase, createTestDatabase } from "../fixtures/db";
import { seedTestUser } from "../fixtures/seed";

// Route handlers read the request through `next/headers`; point it at the
// headers of the request each test builds.
let requestHeaders = new Headers();

void mock.module("next/headers", () => ({
  headers: async () => requestHeaders,
  cookies: async () => ({ get: () => undefined, set: () => undefined }),
}));

const password = "Rider-pass-2026!";
const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const seededUserIds: string[] = [];

function sessionCookieFrom(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

describe("mobile auth integration", async () => {
  const testDb = createTestDatabase();
  const { auth } = await import("@/lib/auth");
  const { GET: getMe } = await import("@/app/api/mobile/v1/me/route");

  afterEach(async () => {
    await cleanupTestRecords(testDb.db, { userIds: seededUserIds.splice(0) });
  });

  afterAll(async () => {
    await closeTestDatabase(testDb.client);
  });

  async function seedUserWithPassword(overrides: { role: UserRole; isActive?: boolean }) {
    // The default seeded username is longer than Better Auth's 30-character sign-in limit.
    const username = `mobile-${crypto.randomUUID().slice(0, 8)}`;
    const user = await seedTestUser(testDb.db, { ...overrides, username });
    seededUserIds.push(user.id);
    await testDb.db.insert(accounts).values({
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: await hashPassword(password),
    });

    return user;
  }

  // Better Auth skips origin checks when it detects a test run, so trusted
  // origin rejection is verified against the dev server, not here.
  function mobileSignIn(username: string) {
    return auth.handler(
      new Request(`${baseURL}/api/auth/sign-in/username`, {
        method: "POST",
        headers: { "content-type": "application/json", "expo-origin": "parcelflow://" },
        body: JSON.stringify({ username, password }),
      }),
    );
  }

  test("a rider signs in from the app and loads their profile", async () => {
    const rider = await seedUserWithPassword({ role: "rider" });

    const signInResponse = await mobileSignIn(rider.username);
    expect(signInResponse.status).toBe(200);

    requestHeaders = new Headers({ cookie: sessionCookieFrom(signInResponse) });
    const meResponse = await getMe();
    const body = mobileMeResponseSchema.parse(await meResponse.json());

    expect(meResponse.status).toBe(200);
    expect(body.data).toMatchObject({ id: rider.id, username: rider.username, role: "rider" });
  });

  test("a merchant can sign in but gets 403 from the rider API", async () => {
    const merchant = await seedUserWithPassword({ role: "merchant" });

    const signInResponse = await mobileSignIn(merchant.username);
    expect(signInResponse.status).toBe(200);

    requestHeaders = new Headers({ cookie: sessionCookieFrom(signInResponse) });
    expect((await getMe()).status).toBe(403);
  });

  test("an inactive rider can't sign in", async () => {
    const rider = await seedUserWithPassword({ role: "rider", isActive: false });

    const signInResponse = await mobileSignIn(rider.username);

    expect(signInResponse.status).toBe(403);
    expect(await signInResponse.text()).toContain("inactive");
  });

  test("no session gets 401", async () => {
    requestHeaders = new Headers();

    expect((await getMe()).status).toBe(401);
  });
});
