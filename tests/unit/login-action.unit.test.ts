import { beforeEach, describe, expect, mock, test } from "bun:test";

const signInUsernameMock = mock(async () => ({
  user: {
    role: "super_admin",
    isActive: true,
  },
}));
const headersMock = mock(async () => new Headers());
const redirectMock = mock((value: string) => value);

void mock.module("@/lib/auth", () => ({
  auth: {
    api: {
      signInUsername: signInUsernameMock,
    },
  },
}));

void mock.module("next/headers", () => ({
  headers: headersMock,
}));

void mock.module("next/navigation", () => ({
  redirect: redirectMock,
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

describe("login action", async () => {
  const { loginAction } = await import("@/features/auth/server/login");

  beforeEach(() => {
    signInUsernameMock.mockReset();
    headersMock.mockReset();
    redirectMock.mockReset();

    signInUsernameMock.mockResolvedValue({
      user: {
        role: "super_admin",
        isActive: true,
      },
    });
    headersMock.mockResolvedValue(new Headers());
    redirectMock.mockImplementation((value: string) => value);
  });

  test("rejects invalid login input before calling auth", async () => {
    const formData = new FormData();
    formData.set("username", "  ");
    formData.set("password", "");

    const result = await loginAction({ username: "", message: null }, formData);

    expect(result).toEqual({
      username: "  ",
      message: "Username is required.",
    });
    expect(signInUsernameMock).not.toHaveBeenCalled();
  });

  test("returns an inactive-account message without redirecting", async () => {
    signInUsernameMock.mockResolvedValue({
      user: {
        role: "merchant",
        isActive: false,
      },
    });
    const formData = new FormData();
    formData.set("username", "merchant-user");
    formData.set("password", "password123");

    const result = await loginAction({ username: "", message: null }, formData);

    expect(result).toEqual({
      username: "merchant-user",
      message: "Your account is inactive. Contact an admin.",
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  test("returns an auth-failure message when sign in throws", async () => {
    signInUsernameMock.mockRejectedValue(new Error("invalid credentials"));
    const formData = new FormData();
    formData.set("username", "merchant-user");
    formData.set("password", "password123");

    const result = await loginAction({ username: "", message: null }, formData);

    expect(result).toEqual({
      username: "merchant-user",
      message: "Username or password is incorrect.",
    });
  });

  test("redirects successful logins to the role landing path", async () => {
    signInUsernameMock.mockResolvedValue({
      user: {
        role: "rider",
        isActive: true,
      },
    });
    const formData = new FormData();
    formData.set("username", "rider-user");
    formData.set("password", "password123");

    await loginAction({ username: "", message: null }, formData);

    expect(signInUsernameMock).toHaveBeenCalledWith({
      body: {
        username: "rider-user",
        password: "password123",
      },
      headers: expect.any(Headers),
    });
    expect(redirectMock).toHaveBeenCalledWith("/dashboard/rider/parcels");
  });
});
