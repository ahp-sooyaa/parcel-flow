import { beforeEach, describe, expect, mock, test } from "bun:test";
import { readFile } from "node:fs/promises";

import { mobileErrorResponseSchema, mobileMeResponseSchema } from "@/features/mobile-api/contract";
import { getMobileTrustedOrigins, MOBILE_APP_ORIGIN } from "@/lib/auth-trusted-origins";
import { buildSessionUser } from "../fixtures/builders";

const getSessionMock = mock(async (): Promise<unknown> => null);
const headersMock = mock(async () => new Headers());

void mock.module("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

void mock.module("next/headers", () => ({
  headers: headersMock,
}));

describe("mobile current user route", async () => {
  const { GET } = await import("@/app/api/mobile/v1/me/route");

  beforeEach(() => {
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue(null);
    headersMock.mockReset();
    headersMock.mockResolvedValue(new Headers());
  });

  test("returns the rider's mobile profile", async () => {
    getSessionMock.mockResolvedValue(
      buildSessionUser({
        id: "rider-1",
        name: "Ko Aung",
        username: "ko-aung",
        email: "ko-aung@internal.parcel-flow.test",
        phoneNumber: "09111111111",
        address: "Sanchaung, Yangon",
        role: "rider",
        mustResetPassword: true,
      }),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mobileMeResponseSchema.parse(body)).toEqual({
      ok: true,
      message: "Profile loaded.",
      data: {
        id: "rider-1",
        name: "Ko Aung",
        username: "ko-aung",
        phoneNumber: "09111111111",
        role: "rider",
        mustResetPassword: true,
      },
    });
    expect(JSON.stringify(body)).not.toContain("ko-aung@internal");
    expect(JSON.stringify(body)).not.toContain("Sanchaung");
  });

  test("returns 401 without a session", async () => {
    const response = await GET();

    expect(response.status).toBe(401);
    expect(mobileErrorResponseSchema.parse(await response.json()).message).toBe(
      "Authentication required.",
    );
  });

  test.each(["super_admin", "office_admin", "merchant"] as const)(
    "returns 403 for %s users",
    async (role) => {
      getSessionMock.mockResolvedValue(buildSessionUser({ role }));

      const response = await GET();

      expect(response.status).toBe(403);
      expect(mobileErrorResponseSchema.safeParse(await response.json()).success).toBe(true);
    },
  );

  test("returns 403 for an inactive rider", async () => {
    getSessionMock.mockResolvedValue(buildSessionUser({ role: "rider", isActive: false }));

    const response = await GET();

    expect(response.status).toBe(403);
    expect((await response.json()).message).toBe("Account is inactive.");
  });

  test("returns a generic 500 when the session can't be read", async () => {
    getSessionMock.mockRejectedValue(new Error("database connection details"));

    const response = await GET();

    expect(response.status).toBe(500);
    expect((await response.json()).message).toBe("Unable to load your profile.");
  });
});

describe("mobile trusted origins", () => {
  test("always trusts the app scheme", () => {
    expect(getMobileTrustedOrigins(undefined)).toEqual([MOBILE_APP_ORIGIN]);
    expect(getMobileTrustedOrigins("")).toEqual([MOBILE_APP_ORIGIN]);
  });

  test("adds trimmed, de-duplicated configured origins", () => {
    expect(getMobileTrustedOrigins(" exp:// , parcelflow://,, exp://192.168.1.5:8081 ")).toEqual([
      MOBILE_APP_ORIGIN,
      "exp://",
      "exp://192.168.1.5:8081",
    ]);
  });
});

describe("mobile api contract", () => {
  test("has no server-only or path-alias imports", async () => {
    const source = await readFile("src/features/mobile-api/contract.ts", "utf8");
    const importSources = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);

    expect(importSources).toEqual(["zod"]);
  });
});
