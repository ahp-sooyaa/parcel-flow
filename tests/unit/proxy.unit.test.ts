import { beforeEach, describe, expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";

import { buildSessionUser } from "../fixtures/builders";

const getSessionMock = mock(async (): Promise<unknown> => null);

void mock.module("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

describe("dashboard proxy", async () => {
  const { proxy } = await import("@/proxy");

  beforeEach(() => {
    getSessionMock.mockReset();
  });

  test("redirects unauthenticated dashboard requests to login", async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await proxy(makeRequest("/dashboard/parcels"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  test("redirects inactive users to login", async () => {
    getSessionMock.mockResolvedValue(buildSessionUser({ role: "merchant", isActive: false }));

    const response = await proxy(makeRequest("/dashboard/merchant/parcels"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  test("allows a role-scoped dashboard path", async () => {
    getSessionMock.mockResolvedValue(buildSessionUser({ role: "merchant" }));

    const response = await proxy(makeRequest("/dashboard/merchant/parcels"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  test("redirects out-of-scope role paths to the role landing path", async () => {
    getSessionMock.mockResolvedValue(buildSessionUser({ role: "rider" }));

    const response = await proxy(makeRequest("/dashboard/parcels"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/dashboard/rider/parcels");
  });

  test("lets super admins access any dashboard path", async () => {
    getSessionMock.mockResolvedValue(buildSessionUser({ role: "super_admin" }));

    const response = await proxy(makeRequest("/dashboard/rider/parcels"));

    expect(response.status).toBe(200);
  });

  test("allows office admins on admin dashboard pages but not role-scoped pages", async () => {
    getSessionMock.mockResolvedValue(buildSessionUser({ role: "office_admin" }));

    const allowedResponse = await proxy(makeRequest("/dashboard/parcels"));
    const blockedResponse = await proxy(makeRequest("/dashboard/merchant/parcels"));

    expect(allowedResponse.status).toBe(200);
    expect(blockedResponse.status).toBe(307);
    expect(blockedResponse.headers.get("location")).toBe("http://localhost/dashboard/parcels");
  });

  test("allows merchants and riders to access settings", async () => {
    getSessionMock.mockResolvedValue(buildSessionUser({ role: "merchant" }));
    const merchantResponse = await proxy(makeRequest("/dashboard/settings"));

    getSessionMock.mockResolvedValue(buildSessionUser({ role: "rider" }));
    const riderResponse = await proxy(makeRequest("/dashboard/settings"));

    expect(merchantResponse.status).toBe(200);
    expect(riderResponse.status).toBe(200);
  });

  test("redirects malformed session metadata back to login", async () => {
    const session = buildSessionUser({ role: "merchant" });
    getSessionMock.mockResolvedValue({
      ...session,
      user: {
        isActive: true,
      },
    });

    const response = await proxy(makeRequest("/dashboard/merchant/parcels"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });
});

function makeRequest(pathname: string) {
  return new NextRequest(new URL(pathname, "http://localhost"));
}
