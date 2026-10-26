import { APIError } from "better-auth/api";

export const INACTIVE_ACCOUNT_MESSAGE = "Your account is inactive. Contact an admin.";

/**
 * Builds a Better Auth `session.create.before` hook that refuses to start a
 * session for a deactivated user. Running at session creation covers every
 * sign-in path (login form, demo login, the HTTP sign-in endpoint), instead of
 * checking after a session already exists.
 */
export function createActiveUserSessionGuard(
  findUserIsActive: (userId: string) => Promise<boolean | null>,
) {
  return async (session: { userId: string }) => {
    const isActive = await findUserIsActive(session.userId);

    if (isActive !== true) {
      throw new APIError("FORBIDDEN", {
        code: "ACCOUNT_INACTIVE",
        message: INACTIVE_ACCOUNT_MESSAGE,
      });
    }
  };
}
