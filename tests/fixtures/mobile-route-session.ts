// Session stub for the mobile route unit tests: nobody is signed in until a
// test calls `signInAs`, and `signOut` resets it in `beforeEach`.
import { mock } from "bun:test";

import type { CurrentUser } from "@/lib/session";
import { buildSessionUser } from "./builders";

export function mockMobileRouteSession(userId: string) {
  const getSessionMock = mock((): Promise<unknown> => Promise.resolve(null));

  void mock.module("@/lib/auth", () => ({
    auth: {
      api: {
        getSession: getSessionMock,
      },
    },
  }));

  void mock.module("next/headers", () => ({
    headers: () => Promise.resolve(new Headers()),
  }));

  return {
    signInAs(role: CurrentUser["role"], isActive = true) {
      getSessionMock.mockResolvedValue(buildSessionUser({ id: userId, role, isActive }));
    },
    signOut() {
      getSessionMock.mockReset();
      getSessionMock.mockResolvedValue(null);
    },
  };
}
