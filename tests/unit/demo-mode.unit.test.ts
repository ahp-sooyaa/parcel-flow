import { afterEach, describe, expect, mock, test } from "bun:test";

const selectWhereMock = mock(async (): Promise<Array<{ username: string }>> => []);

void mock.module("@/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: selectWhereMock }) }),
  },
}));

void mock.module("@/lib/auth", () => ({
  auth: { api: {} },
}));

const {
  assertDemoAllowed,
  DEMO_ASSET_KEYS,
  DemoRestrictedError,
  isAllowedAuthEndpointInDemo,
  isDemoMode,
  pickDemoProofImageKey,
} = await import("@/lib/demo");
const { createRateLimiter, getClientIp } = await import("@/lib/rate-limit");
const { assertSafeToResetDemo, DemoResetRefusedError } =
  await import("@/features/demo/server/reset");

async function captureError(promise: Promise<unknown>) {
  try {
    await promise;
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

afterEach(() => {
  delete process.env.NEXT_PUBLIC_DEMO_MODE;
  selectWhereMock.mockReset();
});

describe("demo mode flag", () => {
  test("is off unless NEXT_PUBLIC_DEMO_MODE is exactly 1", () => {
    expect(isDemoMode()).toBe(false);
    process.env.NEXT_PUBLIC_DEMO_MODE = "true";
    expect(isDemoMode()).toBe(false);
    process.env.NEXT_PUBLIC_DEMO_MODE = "1";
    expect(isDemoMode()).toBe(true);
  });

  test("assertDemoAllowed blocks visitors but not the super admin", () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "1";

    for (const role of ["office_admin", "merchant", "rider"] as const) {
      expect(() => assertDemoAllowed({ role })).toThrow(DemoRestrictedError);
    }
    expect(() => assertDemoAllowed({ role: "super_admin" })).not.toThrow();
  });

  test("assertDemoAllowed is a no-op outside demo mode", () => {
    expect(() => assertDemoAllowed({ role: "rider" })).not.toThrow();
  });

  test("picks a seeded proof image deterministically", () => {
    const key = pickDemoProofImageKey("parcel-1");

    expect(DEMO_ASSET_KEYS.proofImages).toContain(key);
    expect(pickDemoProofImageKey("parcel-1")).toBe(key);
  });
});

describe("demo auth endpoint allowlist", () => {
  test("allows only sign-in, sign-out and session reads", () => {
    expect(isAllowedAuthEndpointInDemo("POST", "/api/auth/sign-in/username")).toBe(true);
    expect(isAllowedAuthEndpointInDemo("POST", "/api/auth/sign-out")).toBe(true);
    expect(isAllowedAuthEndpointInDemo("GET", "/api/auth/get-session")).toBe(true);
  });

  test("blocks admin and account endpoints", () => {
    for (const path of [
      "/api/auth/admin/remove-user",
      "/api/auth/admin/set-role",
      "/api/auth/admin/impersonate-user",
      "/api/auth/change-password",
      "/api/auth/update-user",
      "/api/auth/sign-up/email",
    ]) {
      expect(isAllowedAuthEndpointInDemo("POST", path)).toBe(false);
    }
    expect(isAllowedAuthEndpointInDemo("GET", "/api/auth/admin/list-users")).toBe(false);
  });
});

describe("rate limiter", () => {
  test("allows a burst, then refills over time", () => {
    const limiter = createRateLimiter({ capacity: 2, refillPerMinute: 60 });
    const start = 1_000_000;

    expect(limiter.take("ip", start)).toBe(true);
    expect(limiter.take("ip", start)).toBe(true);
    expect(limiter.take("ip", start)).toBe(false);
    expect(limiter.take("other-ip", start)).toBe(true);
    expect(limiter.take("ip", start + 1_000)).toBe(true);
  });

  test("evicts the oldest key once full", () => {
    const limiter = createRateLimiter({ capacity: 1, refillPerMinute: 1, maxKeys: 2 });

    expect(limiter.take("a", 0)).toBe(true);
    expect(limiter.take("b", 0)).toBe(true);
    expect(limiter.take("c", 0)).toBe(true);
    // "a" was evicted, so it starts with a full bucket again (evicting "b").
    expect(limiter.take("a", 0)).toBe(true);
    // "c" is still tracked and empty.
    expect(limiter.take("c", 0)).toBe(false);
  });

  test("reads the first forwarded IP", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});

describe("demo reset safety check", () => {
  test("refuses when demo mode is off", async () => {
    expect(await captureError(assertSafeToResetDemo())).toBeInstanceOf(DemoResetRefusedError);
    expect(selectWhereMock).not.toHaveBeenCalled();
  });

  test("refuses when an account the seed did not create exists", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "1";
    selectWhereMock.mockResolvedValue([{ username: "demo-rider" }, { username: "real-person" }]);

    const error = await captureError(assertSafeToResetDemo());

    expect(error).toBeInstanceOf(DemoResetRefusedError);
    expect(error?.message).toContain("real-person");
  });

  test("passes when only seeded demo accounts exist", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "1";
    selectWhereMock.mockResolvedValue([{ username: "demo-admin" }, { username: "rider-nay-lin" }]);

    expect(await captureError(assertSafeToResetDemo())).toBeNull();
  });

  test("--force skips the account check", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "1";

    expect(await captureError(assertSafeToResetDemo({ force: true }))).toBeNull();
    expect(selectWhereMock).not.toHaveBeenCalled();
  });
});
