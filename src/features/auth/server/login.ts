"use server";

import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getRoleLandingPath } from "@/lib/session";

export type LoginFormState = {
  username: string;
  message: string | null;
};

const loginInputSchema = z.object({
  username: z.string().trim().min(1, "Username is required."),
  password: z.string().min(1, "Password is required."),
});

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

  const { username, password } = parseResult.data;

  let landingPath: string;

  try {
    const result = await auth.api.signInUsername({
      body: {
        username,
        password,
      },
      headers: await headers(),
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
    Sentry.withScope((scope) => {
      scope.setTag("auth.flow", "login");
      scope.setContext("login", {
        username,
        betterAuthUrlSet: Boolean(process.env.BETTER_AUTH_URL),
      });
      Sentry.captureException(error);
    });
    Sentry.logger.error("login_failed", { username });

    return {
      username,
      message: "Username or password is incorrect.",
    };
  }

  return redirect(landingPath);
}
