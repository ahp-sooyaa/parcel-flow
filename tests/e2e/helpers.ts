import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export async function signIn(page: Page, user: { username: string; password: string }) {
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
}
