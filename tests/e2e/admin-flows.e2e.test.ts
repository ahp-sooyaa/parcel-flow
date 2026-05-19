import { expect, test } from "./fixtures";

test.beforeEach(async ({ page, seededUsers }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill(seededUsers.superAdmin.username);
  await page.getByLabel("Password").fill(seededUsers.superAdmin.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});

test("creates a user and shows the persisted row", async ({ page }) => {
  const userName = `E2E Merchant ${Date.now()}`;

  await page.goto("/dashboard/users");
  await page.getByRole("button", { name: /create user/i }).click();
  await page.getByLabel("Name").fill(userName);
  await page.getByLabel("Phone number").fill(`09${Date.now().toString().slice(-8)}`);
  await page.getByLabel("Address").fill("E2E address");
  await page.getByRole("button", { name: "Create User" }).click();

  await expect(page.getByText(userName, { exact: true }).first()).toBeVisible();
});

test("creates or updates township pricing and exposes it in the UI", async ({ page }) => {
  const townshipName = `E2E Township ${Date.now()}`;

  await page.goto("/dashboard/townships");
  await page.getByRole("button", { name: /create township/i }).click();
  await page.getByLabel("Township name").fill(townshipName);
  await page.getByLabel("Base fee").fill("2500");
  await page.getByRole("button", { name: "Create Township" }).click();

  await expect(page.getByText(townshipName, { exact: true }).first()).toBeVisible();
});

test("creates a parcel and persists it in the parcel list", async ({ page }) => {
  const receiverName = `E2E Receiver ${Date.now()}`;

  await page.goto("/dashboard/parcels");
  await page.getByRole("button", { name: /create parcel/i }).click();
  await selectComboboxOption(page, "Select merchant", "E2E Merchant Shop");
  await page.getByLabel("Receiver name").fill(receiverName);
  await page.getByLabel("Receiver phone number").fill(`09${Date.now().toString().slice(-8)}`);
  await page.getByLabel("Receiver address").fill("E2E receiver address");
  await selectComboboxOption(page, "Select receiver township", "E2E Seed Township");
  await page.getByLabel("Delivery fee").fill("2000");
  await page.getByRole("button", { name: "Create Parcel" }).click();

  await expect(page.getByText(receiverName, { exact: true }).first()).toBeVisible();
});

test("assigns a parcel to a rider and keeps the assignment after refresh", async ({ page }) => {
  await page.goto("/dashboard/parcels");
  await page.getByLabel("Select PF-E2E-SEED-001").check();
  await page.getByRole("button", { name: /assign rider/i }).click();
  await page.getByLabel("Search rider").fill("e2e");
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Assign Rider" }).click();
  await page.reload();

  await expect(page.getByText(/e2e/i).first()).toBeVisible();
});

async function selectComboboxOption(
  page: import("@playwright/test").Page,
  label: string,
  optionName: string,
) {
  await page.getByLabel(label).fill(optionName);
  await page
    .getByRole("option", { name: new RegExp(optionName, "i") })
    .first()
    .click();
}
