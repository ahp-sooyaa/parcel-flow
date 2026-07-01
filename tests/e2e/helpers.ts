import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

const defaultSignInRedirectTimeoutMs = 120_000;

export const superAdminCredentials = {
  username: process.env.E2E_SUPER_ADMIN_USERNAME ?? "e2e-super-admin",
  password: process.env.E2E_SUPER_ADMIN_PASSWORD ?? "password123",
};

export async function signIn(
  page: Page,
  user: { username: string; password: string },
  options?: { redirectTimeoutMs?: number },
) {
  const redirectTimeoutMs = options?.redirectTimeoutMs ?? defaultSignInRedirectTimeoutMs;

  await page.goto("/login");

  const usernameInput = page.getByLabel("Username");
  const passwordInput = page.getByLabel("Password");
  await expect(usernameInput).toBeVisible();
  await expect(passwordInput).toBeVisible();

  await usernameInput.fill(user.username);
  await passwordInput.fill(user.password);
  await expect(usernameInput).toHaveValue(user.username);
  await expect(passwordInput).toHaveValue(user.password);

  await page.getByRole("button", { name: "Sign in" }).click();

  try {
    await expect(page).toHaveURL(/\/dashboard/, { timeout: redirectTimeoutMs });
  } catch {
    if (new URL(page.url()).pathname.includes("/login")) {
      const err = await page.locator(".text-destructive").textContent();
      throw new Error(`Sign-in did not redirect. ${err ?? "No error message."}`);
    }

    throw new Error(`Sign-in did not redirect. Current URL: ${page.url()}`);
  }
}
