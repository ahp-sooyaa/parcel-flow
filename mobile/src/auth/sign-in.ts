import { MobileApiError, NETWORK_ERROR_MESSAGE } from "@/api/client";
import { meQueryOptions } from "@/api/me";
import { queryClient } from "@/api/query-client";
import { authClient } from "@/auth/client";
import { signOutRider } from "@/auth/session";

export const WRONG_CREDENTIALS_MESSAGE = "Incorrect username or password.";
const SIGN_IN_FAILED_MESSAGE = "Couldn't sign in. Try again.";

export type SignInResult = { ok: true } | { ok: false; message: string };

/**
 * Signs in with Better Auth, then loads `/me` before letting the rider in.
 * Sign-in itself isn't role-gated on the server, so a merchant or admin gets a
 * session here; `/me` answers 403 for them and the session is dropped again.
 */
export async function signInRider(username: string, password: string): Promise<SignInResult> {
  let result: Awaited<ReturnType<typeof authClient.signIn.username>>;

  try {
    result = await authClient.signIn.username({ username: username.trim(), password });
  } catch {
    return { ok: false, message: NETWORK_ERROR_MESSAGE };
  }

  if (result.error) {
    const { code, message, status } = result.error;

    if (code === "INVALID_USERNAME_OR_PASSWORD" || status === 401) {
      return { ok: false, message: WRONG_CREDENTIALS_MESSAGE };
    }

    if (code === "ACCOUNT_INACTIVE" && message) {
      return { ok: false, message };
    }

    return {
      ok: false,
      message: status ? (message ?? SIGN_IN_FAILED_MESSAGE) : NETWORK_ERROR_MESSAGE,
    };
  }

  try {
    await queryClient.fetchQuery(meQueryOptions);
  } catch (error) {
    await signOutRider();

    // The server's 403 message already says why: not a rider, or inactive.
    return {
      ok: false,
      message: error instanceof MobileApiError ? error.message : SIGN_IN_FAILED_MESSAGE,
    };
  }

  return { ok: true };
}
