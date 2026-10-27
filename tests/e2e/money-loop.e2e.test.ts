import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "./fixtures";
import { signIn } from "./helpers";

test.describe.configure({ mode: "serial", timeout: 240_000 });

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const proofImage = {
  name: "proof.jpg",
  mimeType: "image/jpeg",
  buffer: readFileSync(path.join(fixturesDir, "proof.jpg")),
};

test("runs the COD money loop from create through settlement and rider payout", async ({
  page,
  seededUsers,
}) => {
  const stamp = Date.now();
  const receiverName = `Money Loop Receiver ${stamp}`;
  const receiverPhone = `09${String(stamp).slice(-8)}`;

  await signIn(page, seededUsers.superAdmin);

  await page.goto("/dashboard/parcels");
  await page.getByRole("button", { name: /create parcel/i }).click();
  await expect(page.getByRole("heading", { name: "Create Parcel" })).toBeVisible();
  await selectComboboxOption(page, "Select merchant", "E2E Merchant Shop");
  await page.getByLabel("Receiver name").fill(receiverName);
  await page.getByLabel("Receiver phone number").fill(receiverPhone);
  await page.getByLabel("Receiver address").fill("Money loop receiver address");
  await selectComboboxOption(page, "Select receiver township", "E2E Seed Township");
  await page.getByLabel("Delivery fee").fill("2000");
  await page.getByRole("checkbox", { name: "Cash on delivery" }).check();
  await expect(page.getByLabel("COD amount")).toBeVisible();
  await page.getByLabel("COD amount").fill("15000");
  await page.locator("form").getByRole("button", { name: "Create Parcel" }).click();
  await expect(page.getByText(/parcel has been created/i).first()).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { name: "Create Parcel" })).toBeHidden({
    timeout: 10_000,
  });

  const parcelSearch = page.getByPlaceholder(
    "Search parcel code, receiver phone, receiver name, merchant",
  );
  await parcelSearch.fill(receiverName);
  await parcelSearch.press("Enter");
  const parcelRow = page.locator("tr", { hasText: receiverName });
  await expect(parcelRow).toBeVisible();
  const parcelCodeMatch = (await parcelRow.innerText()).match(/PF-[A-Z0-9-]+/);
  expect(parcelCodeMatch).not.toBeNull();
  const parcelCode = parcelCodeMatch![0];

  await page.getByRole("checkbox", { name: `Select ${parcelCode}` }).check();
  await page.getByRole("button", { name: /assign rider/i }).click();
  await expect(page.getByRole("heading", { name: "Assign Rider" })).toBeVisible();
  await page.getByLabel("Search rider").fill("e2e");
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: "Assign Rider" }).click();
  await expect(parcelRow.getByText(/e2e/i).first()).toBeVisible({ timeout: 15_000 });

  await signOut(page);
  await signIn(page, seededUsers.rider);

  await page.goto("/dashboard/rider/parcels");
  const riderSearch = page.getByPlaceholder("Search parcel code, receiver name, or phone");
  await riderSearch.fill(parcelCode);
  await riderSearch.press("Enter");
  const parcelCard = page.locator("[data-slot=card]").filter({
    has: page.getByText(parcelCode, { exact: true }),
  });
  await expect(parcelCard).toBeVisible({ timeout: 15_000 });
  await parcelCard.getByRole("button", { name: "Start Delivery" }).click();
  await expect(parcelCard.getByRole("button", { name: "Mark Delivered" })).toBeVisible({
    timeout: 15_000,
  });
  await parcelCard.getByRole("button", { name: "Mark Delivered" }).click();
  await expect(page.getByRole("heading", { name: "Mark Delivered" })).toBeVisible();
  await expect(page.getByText(parcelCode).first()).toBeVisible();
  await page.locator('input[name="proofImage"]').setInputFiles(proofImage);
  await expect(page.getByRole("img", { name: "Delivery proof preview" })).toBeVisible();
  const deliverResponsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/rider/parcels/deliver"),
  );
  await page.getByRole("button", { name: "Save Delivery" }).click();
  const deliverResponse = await deliverResponsePromise;
  const deliverBody = await deliverResponse.json().catch(() => null);
  expect(
    deliverResponse.ok(),
    `Mark delivered failed (${deliverResponse.status()}): ${JSON.stringify(deliverBody)}`,
  ).toBe(true);
  await expect(page.getByRole("heading", { name: "Mark Delivered" })).toBeHidden({
    timeout: 30_000,
  });

  await signOut(page);
  await signIn(page, seededUsers.superAdmin);

  await confirmOfficeHandover(page, parcelCode);

  await expect(async () => {
    await page.goto("/dashboard");
    await page.getByRole("tab", { name: "Merchant Settlements" }).click();
    const merchantRow = page.locator("tr", { hasText: "E2E Merchant Shop" });
    await expect(merchantRow.getByRole("button", { name: "Review" })).toBeVisible({
      timeout: 10_000,
    });
    await merchantRow.getByRole("button", { name: "Review" }).click();
    const settlementDialog = page.getByRole("dialog");
    await expect(
      settlementDialog.getByRole("heading", { name: "Generate Settlement" }),
    ).toBeVisible({
      timeout: 10_000,
    });
    await expect(settlementDialog.getByText(parcelCode, { exact: true })).toBeVisible({
      timeout: 5_000,
    });
  }).toPass({ timeout: 60_000 });

  const settlementDialog = page.getByRole("dialog");
  await settlementDialog.getByRole("checkbox", { name: "Select all settlement items" }).uncheck();
  await settlementDialog
    .getByRole("checkbox", { name: `Select settlement item for ${parcelCode}` })
    .check();
  await settlementDialog.getByRole("button", { name: "Generate Settlement" }).click();
  await expect(settlementDialog).toBeHidden({ timeout: 15_000 });

  await page.goto("/dashboard/settlements");
  const settlementRow = page.locator("tr", { hasText: "E2E Merchant Shop" }).filter({
    has: page.getByRole("button", { name: "Resolve" }),
  });
  await expect(settlementRow.getByRole("button", { name: "Resolve" }).first()).toBeVisible({
    timeout: 15_000,
  });
  await settlementRow.getByRole("button", { name: "Resolve" }).first().click();
  await expect(page.getByRole("heading", { name: "Resolve Settlement" })).toBeVisible();
  await page.locator('input[name="bankTransferReceipt"]').setInputFiles(proofImage);
  await page.getByRole("button", { name: "Mark as Paid" }).click();
  await expect(page.getByRole("heading", { name: "Resolve Settlement" })).toBeHidden({
    timeout: 30_000,
  });
  await expect(page.getByText("Settled").first()).toBeVisible({ timeout: 15_000 });

  await page.goto("/dashboard/rider-payouts");
  await page.getByRole("button", { name: "Create Payout" }).click();
  const payoutDialog = page.getByRole("dialog");
  await expect(payoutDialog.getByRole("heading", { name: "Create Rider Payout" })).toBeVisible();
  await payoutDialog.getByRole("combobox").click();
  await page.getByRole("option", { name: /E2E Rider/i }).click();
  await payoutDialog.getByLabel("Fee per way").fill("1000");
  await expect(payoutDialog.getByText(parcelCode, { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await payoutDialog.getByRole("checkbox", { name: "Select all rider way items" }).uncheck();
  await payoutDialog.getByRole("checkbox", { name: `Select way for ${parcelCode}` }).check();
  await payoutDialog.getByRole("button", { name: "Create Draft" }).click();
  await expect(payoutDialog).toBeHidden({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Manage" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Manage" }).first().click();
  await expect(page.getByRole("heading", { name: "Manage Rider Payout" })).toBeVisible();
  await page.getByRole("button", { name: "Mark as Paid" }).click();
  await expect(page.getByRole("heading", { name: "Manage Rider Payout" })).toBeHidden({
    timeout: 15_000,
  });
  await expect(page.getByText("Settled").first()).toBeVisible({ timeout: 15_000 });
});

async function confirmOfficeHandover(page: import("@playwright/test").Page, parcelCode: string) {
  // Settlement workspace summaries are cached; reload until this parcel appears.
  await expect(async () => {
    await page.goto("/dashboard");
    await page.getByRole("tab", { name: "Rider Cash Handover" }).click();
    const e2eRiderRow = page.locator("tr", { hasText: "E2E Rider" });
    await expect(e2eRiderRow.getByRole("button", { name: "Confirm Handover" })).toBeVisible({
      timeout: 10_000,
    });
    await e2eRiderRow.getByRole("button", { name: "Confirm Handover" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Confirm Rider Handover" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(dialog.getByText(parcelCode, { exact: true })).toBeVisible({
      timeout: 5_000,
    });
  }).toPass({ timeout: 60_000 });

  const dialog = page.getByRole("dialog");
  const parcelCheckbox = dialog.getByRole("checkbox", { name: `Select parcel ${parcelCode}` });
  // Confirm only this parcel so leftover pending handovers do not pollute settlement.
  await dialog.getByRole("checkbox", { name: "Select all rider handover parcels" }).uncheck();
  await parcelCheckbox.check();
  await dialog.getByRole("button", { name: "Confirm Handover" }).click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
}

async function signOut(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
}

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
