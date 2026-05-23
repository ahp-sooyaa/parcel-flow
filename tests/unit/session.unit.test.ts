import { beforeEach, describe, expect, mock, test } from "bun:test";

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

describe("session utilities", async () => {
  const { getCurrentUser, getRoleLandingPath, requireCurrentUser } = await import("@/lib/session");

  beforeEach(() => {
    getSessionMock.mockReset();
    headersMock.mockReset();
    headersMock.mockResolvedValue(new Headers());
  });

  test("maps roles to landing paths", () => {
    expect(getRoleLandingPath("super_admin")).toBe("/dashboard");
    expect(getRoleLandingPath("office_admin")).toBe("/dashboard/parcels");
    expect(getRoleLandingPath("merchant")).toBe("/dashboard/merchant/overview");
    expect(getRoleLandingPath("rider")).toBe("/dashboard/rider/parcels");
  });

  test("maps a complete Better Auth session to the current user shape", async () => {
    const session = buildSessionUser({
      id: "2a4b1882-a877-4873-baa5-605fb5e2c9d3",
      name: "Daw Hnin",
      username: "daw-hnin",
      email: "daw-hnin@internal.parcel-flow.test",
      role: "merchant",
      phoneNumber: "09999999999",
      address: "Yangon",
      age: 35,
      isActive: true,
      mustResetPassword: true,
    });
    getSessionMock.mockResolvedValue(session);

    await expectResolvesTo(getCurrentUser(), {
      id: "2a4b1882-a877-4873-baa5-605fb5e2c9d3",
      name: "Daw Hnin",
      username: "daw-hnin",
      email: "daw-hnin@internal.parcel-flow.test",
      phoneNumber: "09999999999",
      address: "Yangon",
      age: 35,
      role: "merchant",
      isActive: true,
      mustResetPassword: true,
    });
  });

  test("returns null when Better Auth has no session user", async () => {
    getSessionMock.mockResolvedValue(null);

    await expectResolvesTo(getCurrentUser(), null);
  });

  test("rejects sessions missing Parcel Flow metadata", async () => {
    const session = buildSessionUser();
    getSessionMock.mockResolvedValue({
      ...session,
      user: {
        id: session.user.id,
        name: session.user.name,
      },
    });

    await expectRejectsWithMessage(
      getCurrentUser(),
      "Authenticated sessions must include a valid Parcel Flow user role.",
    );
  });

  test("requires an authenticated user", async () => {
    getSessionMock.mockResolvedValue(null);

    await expectRejectsWithMessage(requireCurrentUser(), "Authentication required.");
  });

  test("rejects inactive authenticated users", async () => {
    getSessionMock.mockResolvedValue(buildSessionUser({ isActive: false }));

    await expectRejectsWithMessage(requireCurrentUser(), "Account is inactive.");
  });
});

async function expectResolvesTo<T>(promise: Promise<T>, expected: Awaited<T>) {
  const result = await promise;

  expect(result).toEqual(expected);
}

async function expectRejectsWithMessage(promise: Promise<unknown>, message: string) {
  await promise.then(
    () => {
      throw new Error("Expected promise to reject.");
    },
    (error: unknown) => {
      expect(error).toBeInstanceOf(Error);
      expect(error instanceof Error ? error.message : "").toBe(message);
    },
  );
}
