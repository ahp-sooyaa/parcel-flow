import { expect, test } from "@playwright/test";
import { createE2EAuthHeader } from "../../setup/auth-fixtures";

import type { Page } from "@playwright/test";

async function withAuthHeader(page: Page, context: ReturnType<typeof createE2EAuthHeader>) {
  await page.context().setExtraHTTPHeaders({
    "x-parcel-flow-e2e-auth": JSON.stringify(context),
  });
}

test.describe("dashboard access control", () => {
  test("redirects unauthenticated request to sign-in with next parameter", async ({ page }) => {
    await withAuthHeader(
      page,
      createE2EAuthHeader({
        authenticated: false,
        isActive: false,
      }),
    );

    await page.goto("/dashboard/parcels");

    await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard%2Fparcels/);
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
  });

  test("allows authorized user to reach dashboard page", async ({ page }) => {
    await withAuthHeader(
      page,
      createE2EAuthHeader({
        permissions: ["dashboard-page.view"],
      }),
    );

    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("allows active authenticated user to reach profile page without a separate permission", async ({
    page,
  }) => {
    await withAuthHeader(
      page,
      createE2EAuthHeader({
        permissions: ["dashboard-page.view"],
      }),
    );

    await page.goto("/dashboard/profile");

    await expect(page).toHaveURL(/\/dashboard\/profile$/);
    await expect(page.getByRole("heading", { name: "My Profile" })).toBeVisible();
  });

  test("redirects reset-required user to profile page", async ({ page }) => {
    await withAuthHeader(
      page,
      createE2EAuthHeader({
        mustResetPassword: true,
        permissions: ["dashboard-page.view", "merchant-list.view"],
      }),
    );

    await page.goto("/dashboard/merchants");

    await expect(page).toHaveURL(/\/dashboard\/profile$/);
    await expect(page.getByRole("heading", { name: "My Profile" })).toBeVisible();
  });

  test("redirects unauthorized dashboard route access back to dashboard", async ({ page }) => {
    await withAuthHeader(
      page,
      createE2EAuthHeader({
        permissions: ["dashboard-page.view"],
      }),
    );

    await page.goto("/dashboard/merchants");

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("redirects merchant viewer away from merchant create page", async ({ page }) => {
    await withAuthHeader(
      page,
      createE2EAuthHeader({
        permissions: ["dashboard-page.view"],
        roleSlug: "merchant",
      }),
    );

    await page.goto("/dashboard/merchants/create");

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("allows parcel create route with parcel.create permission", async ({ page }) => {
    await withAuthHeader(
      page,
      createE2EAuthHeader({
        permissions: ["dashboard-page.view", "parcel.create"],
        roleSlug: "merchant",
      }),
    );

    await page.goto("/dashboard/parcels/create");

    await expect(page).toHaveURL(/\/dashboard\/parcels\/create$/);
    await expect(page.getByRole("heading", { name: "Create Parcel" })).toBeVisible();
  });
});
