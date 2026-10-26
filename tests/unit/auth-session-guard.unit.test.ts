import { describe, expect, mock, test } from "bun:test";

import { createActiveUserSessionGuard, INACTIVE_ACCOUNT_MESSAGE } from "@/lib/auth-session-guard";

async function captureError(promise: Promise<unknown>) {
  try {
    await promise;
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

describe("active user session guard", () => {
  test("lets active users start a session", async () => {
    const findUserIsActive = mock(async () => true);
    const guard = createActiveUserSessionGuard(findUserIsActive);

    expect(await captureError(guard({ userId: "user-1" }))).toBeNull();
    expect(findUserIsActive).toHaveBeenCalledWith("user-1");
  });

  test("refuses a session for an inactive user", async () => {
    const guard = createActiveUserSessionGuard(async () => false);
    const error = await captureError(guard({ userId: "user-1" }));

    expect(error?.message).toBe(INACTIVE_ACCOUNT_MESSAGE);
  });

  test("refuses a session for a user that no longer exists", async () => {
    const guard = createActiveUserSessionGuard(async () => null);
    const error = await captureError(guard({ userId: "missing" }));

    expect(error?.message).toBe(INACTIVE_ACCOUNT_MESSAGE);
  });
});
