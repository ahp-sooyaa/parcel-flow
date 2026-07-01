import { expect, test } from "./fixtures";
import { signIn } from "./helpers";

test("redirects unauthenticated dashboard users to login", async ({ page }) => {
  await page.goto("/dashboard/parcels");

  await expect(page).toHaveURL(/\/login$/);
});

test("rejects empty credentials on the login page", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Username is required.")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("redirects merchant users away from admin parcel management", async ({
  page,
  seededUsers,
}) => {
  await signIn(page, seededUsers.merchant);

  await expect(page).toHaveURL(/\/dashboard\/merchant\/overview/);

  await page.goto("/dashboard/parcels");
  await expect(page).toHaveURL(/\/dashboard\/merchant\/overview/);
});

test("signs in a seeded super admin and lands on the admin dashboard", async ({
  page,
  seededUsers,
}) => {
  test.setTimeout(300_000);
  await signIn(page, seededUsers.superAdmin, { redirectTimeoutMs: 180_000 });

  await expect(page).toHaveURL(/\/dashboard/);
});
