import { expect, test } from "@playwright/test";

import type { Page } from "@playwright/test";

type E2EAuthHeader = {
  authenticated: boolean;
  isActive: boolean;
  mustResetPassword: boolean;
  permissions: string[];
  roleSlug?: "super_admin" | "office_admin" | "rider" | "merchant";
};

async function withAuthHeader(page: Page, context: E2EAuthHeader) {
  await page.context().setExtraHTTPHeaders({
    "x-parcel-flow-e2e-auth": JSON.stringify(context),
  });
}

test.describe("dashboard access control", () => {
  test("redirects unauthenticated request to sign-in with next parameter", async ({ page }) => {
    await withAuthHeader(page, {
      authenticated: false,
      isActive: false,
      mustResetPassword: false,
      permissions: [],
    });

    await page.goto("/dashboard/parcels");

    await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard%2Fparcels/);
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
  });

  test("allows authorized user to reach dashboard page", async ({ page }) => {
    await withAuthHeader(page, {
      authenticated: true,
      isActive: true,
      mustResetPassword: false,
      permissions: ["dashboard-page.view"],
      roleSlug: "office_admin",
    });

    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("allows active authenticated user to reach profile page without a separate permission", async ({
    page,
  }) => {
    await withAuthHeader(page, {
      authenticated: true,
      isActive: true,
      mustResetPassword: false,
      permissions: ["dashboard-page.view"],
      roleSlug: "office_admin",
    });

    await page.goto("/dashboard/profile");

    await expect(page).toHaveURL(/\/dashboard\/profile$/);
    await expect(page.getByRole("heading", { name: "My Profile" })).toBeVisible();
  });

  test("redirects reset-required user to profile page", async ({ page }) => {
    await withAuthHeader(page, {
      authenticated: true,
      isActive: true,
      mustResetPassword: true,
      permissions: ["dashboard-page.view", "merchant-list.view"],
      roleSlug: "office_admin",
    });

    await page.goto("/dashboard/merchants");

    await expect(page).toHaveURL(/\/dashboard\/profile$/);
    await expect(page.getByRole("heading", { name: "My Profile" })).toBeVisible();
  });

  test("redirects unauthorized dashboard route access back to dashboard", async ({ page }) => {
    await withAuthHeader(page, {
      authenticated: true,
      isActive: true,
      mustResetPassword: false,
      permissions: ["dashboard-page.view"],
      roleSlug: "office_admin",
    });

    await page.goto("/dashboard/merchants");

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });
});
