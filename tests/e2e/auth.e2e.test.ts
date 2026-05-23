import { expect, test } from "./fixtures";
import { signIn } from "./helpers";

test("redirects unauthenticated dashboard users to login", async ({ page }) => {
  await page.goto("/dashboard/parcels");

  await expect(page).toHaveURL(/\/login$/);
});

test("signs in a seeded super admin and lands on the admin dashboard", async ({
  page,
  seededUsers,
}) => {
  await signIn(page, seededUsers.superAdmin);

  await expect(page).toHaveURL(/\/dashboard/);
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
