"use server";

import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { getRoleLandingPath } from "@/lib/session";
import { TEXT_LIMITS } from "@/lib/validation";

export type LoginFormState = {
  username: string;
  message: string | null;
};

const loginInputSchema = z.object({
  username: z.string().trim().min(1, "Username is required.").max(TEXT_LIMITS.username),
  password: z.string().min(1, "Password is required.").max(TEXT_LIMITS.password),
});

const loginLimiter = createRateLimiter({ capacity: 10, refillPerMinute: 5 });

const signedInUserSchema = z.looseObject({
  role: z.enum(["super_admin", "office_admin", "merchant", "rider"]),
  isActive: z.boolean().optional(),
});

export async function loginAction(
  _previousState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const submittedUsername = formData.get("username");
  const usernameValue = typeof submittedUsername === "string" ? submittedUsername : "";
  const parseResult = loginInputSchema.safeParse({
    username: usernameValue,
    password: formData.get("password"),
  });

  if (!parseResult.success) {
    return {
      username: usernameValue,
      message: parseResult.error.issues[0]?.message ?? "Invalid login details.",
    };
  }

  const username = parseResult.data.username.trim().toLowerCase();
  const { password } = parseResult.data;
  const requestHeaders = await headers();

  if (!loginLimiter.take(getClientIp(requestHeaders))) {
    return {
      username,
      message: "Too many sign-in attempts. Wait a minute and try again.",
    };
  }

  let landingPath: string;

  try {
    const result = await auth.api.signInUsername({
      body: {
        username,
        password,
      },
      headers: requestHeaders,
    });

    const user = signedInUserSchema.parse(result.user);

    if (user.isActive === false) {
      return {
        username,
        message: "Your account is inactive. Contact an admin.",
      };
    }

    landingPath = getRoleLandingPath(user.role);
  } catch (error) {
    const betterAuthMessage =
      error instanceof Error && error.message.trim().length > 0 ? error.message : null;

    Sentry.withScope((scope) => {
      scope.setTag("auth.flow", "login");
      scope.setContext("login", {
        username,
        betterAuthUrlSet: Boolean(process.env.BETTER_AUTH_URL),
        betterAuthMessage,
      });
      Sentry.captureException(error);
    });
    Sentry.logger.error("login_failed", { username, betterAuthMessage });

    return {
      username,
      message:
        betterAuthMessage === "Username is invalid"
          ? "Username must be lowercase letters, numbers, or hyphens."
          : "Username or password is incorrect.",
    };
  }

  return redirect(landingPath);
}
