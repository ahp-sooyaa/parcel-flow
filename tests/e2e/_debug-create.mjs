import { chromium } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3103";

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("response", async (res) => {
  const req = res.request();
  if (req.method() === "POST") {
    let body = "";
    try {
      body = (await res.text()).slice(0, 400);
    } catch {
      body = "<unreadable>";
    }
    console.log("POST", res.status(), res.url(), body);
  }
});

await page.goto(`${baseURL}/login`);
await page.getByLabel("Username").fill(process.env.E2E_SUPER_ADMIN_USERNAME ?? "e2e-super-admin");
await page.getByLabel("Password").fill(process.env.E2E_SUPER_ADMIN_PASSWORD ?? "password123");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL(/\/dashboard/);
await page.goto(`${baseURL}/dashboard/parcels`);
await page.getByRole("button", { name: /create parcel/i }).click();
await page.getByLabel("Select merchant").fill("E2E Merchant Shop");
await page
  .getByRole("option", { name: /E2E Merchant Shop/i })
  .first()
  .click();
await page.getByLabel("Receiver name").fill("Debug Receiver Y");
await page.getByLabel("Receiver phone number").fill("09998887767");
await page.getByLabel("Receiver address").fill("Debug address");
await page.getByLabel("Select receiver township").fill("E2E Seed Township");
await page
  .getByRole("option", { name: /E2E Seed Township/i })
  .first()
  .click();
await page.getByLabel("Delivery fee").fill("2000");
await page.getByRole("checkbox", { name: "Cash on delivery" }).check();
await page.getByLabel("COD amount").fill("15000");
await page.locator("form").getByRole("button", { name: "Create Parcel" }).click();
await page.waitForTimeout(5000);
console.log(
  "heading visible",
  await page.getByRole("heading", { name: "Create Parcel" }).isVisible(),
);
console.log(
  "sheet",
  (await page.locator("[data-slot=sheet-content]").first().innerText()).slice(0, 1000),
);
await browser.close();
