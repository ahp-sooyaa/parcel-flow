import { MobileApiError, NETWORK_ERROR_MESSAGE } from "@/api/client";
import { queryClient } from "@/api/query-client";
import { authClient } from "@/auth/client";
import { signOutRider } from "@/auth/session";
import { signInRider, WRONG_CREDENTIALS_MESSAGE } from "@/auth/sign-in";

jest.mock("@/auth/client", () => ({
  authClient: {
    signIn: { username: jest.fn() },
    getCookie: jest.fn(() => ""),
  },
}));

jest.mock("@/auth/session", () => ({
  signOutRider: jest.fn(async () => undefined),
}));

const signInUsername = jest.mocked(authClient.signIn.username);

function signInSucceeds() {
  signInUsername.mockResolvedValue({ data: { token: "t" }, error: null } as never);
}

function signInFails(error: { status: number; code?: string; message?: string }) {
  signInUsername.mockResolvedValue({ data: null, error } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
});

describe("signInRider", () => {
  it("lets an active rider in once /me loads", async () => {
    signInSucceeds();
    const fetchQuery = jest.spyOn(queryClient, "fetchQuery").mockResolvedValue({ id: "rider-1" });

    await expect(signInRider("  ko-aung ", "secret")).resolves.toEqual({ ok: true });

    expect(signInUsername).toHaveBeenCalledWith({ username: "ko-aung", password: "secret" });
    expect(fetchQuery).toHaveBeenCalled();
    expect(signOutRider).not.toHaveBeenCalled();
  });

  it("reports wrong credentials", async () => {
    signInFails({
      status: 401,
      code: "INVALID_USERNAME_OR_PASSWORD",
      message: "Invalid username or password",
    });

    await expect(signInRider("ko-aung", "wrong")).resolves.toEqual({
      ok: false,
      message: WRONG_CREDENTIALS_MESSAGE,
    });
  });

  it("shows the server's inactive-account message", async () => {
    signInFails({
      status: 403,
      code: "ACCOUNT_INACTIVE",
      message: "Your account is inactive. Contact an admin.",
    });

    await expect(signInRider("ko-aung", "secret")).resolves.toEqual({
      ok: false,
      message: "Your account is inactive. Contact an admin.",
    });
  });

  it("drops the session of a non-rider and shows the server's message", async () => {
    signInSucceeds();
    jest
      .spyOn(queryClient, "fetchQuery")
      .mockRejectedValue(new MobileApiError(403, "The mobile app is only available to riders."));

    await expect(signInRider("daw-hnin", "secret")).resolves.toEqual({
      ok: false,
      message: "The mobile app is only available to riders.",
    });
    expect(signOutRider).toHaveBeenCalledTimes(1);
  });

  it("reports a network failure when sign-in can't reach the server", async () => {
    signInUsername.mockRejectedValue(new TypeError("Network request failed"));

    await expect(signInRider("ko-aung", "secret")).resolves.toEqual({
      ok: false,
      message: NETWORK_ERROR_MESSAGE,
    });
  });
});
