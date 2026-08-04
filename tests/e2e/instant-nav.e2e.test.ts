import { instant } from "@next/playwright";
import { expect, test } from "@playwright/test";

const SHELL_MARKER = '[data-testid="page-shell-marker"]';
const DYNAMIC_CONTENT = '[data-testid="page-dynamic-content"]';
const PAGE_LOADING = '[data-testid="page-loading"]';

type SoftNavCase = {
  name: string;
  from: string;
  linkName: string;
  shellTitle: string;
};

const softNavCases: SoftNavCase[] = [
  {
    name: "dashboard -> parcels",
    from: "/dashboard",
    linkName: "Parcels",
    shellTitle: "Parcels",
  },
  {
    name: "parcels -> merchants",
    from: "/dashboard/parcels",
    linkName: "Merchants",
    shellTitle: "Merchants",
  },
  {
    name: "merchants -> riders",
    from: "/dashboard/merchants",
    linkName: "Riders",
    shellTitle: "Riders",
  },
  {
    name: "riders -> settlements",
    from: "/dashboard/riders",
    linkName: "Settlements",
    shellTitle: "Merchant Settlements",
  },
  {
    name: "settlements -> rider payouts",
    from: "/dashboard/settlements",
    linkName: "Rider Payouts",
    shellTitle: "Rider Payouts",
  },
  {
    name: "rider payouts -> townships",
    from: "/dashboard/rider-payouts",
    linkName: "Townships",
    shellTitle: "Townships",
  },
  {
    name: "townships -> users",
    from: "/dashboard/townships",
    linkName: "Users",
    shellTitle: "Users",
  },
  {
    name: "users -> settings",
    from: "/dashboard/users",
    linkName: "Settings",
    shellTitle: "Settings",
  },
];

test.describe("instant nav: admin soft navigations", () => {
  for (const navCase of softNavCases) {
    test(`${navCase.name}: shell commits under instant()`, async ({ page }) => {
      await page.goto(navCase.from);
      await expect(page.locator(SHELL_MARKER)).toBeVisible({ timeout: 30_000 });

      const trigger = page.getByRole("link", { name: navCase.linkName, exact: true });
      await expect(trigger).toBeVisible({ timeout: 20_000 });

      await instant(page, async () => {
        await trigger.click();
        await expect(page.locator(SHELL_MARKER)).toContainText(navCase.shellTitle);
        await expect(page.locator(PAGE_LOADING)).toBeVisible();
        await expect(page.locator(DYNAMIC_CONTENT)).toHaveCount(0);
      });

      await page.reload();
      await expect(page.locator(DYNAMIC_CONTENT)).toBeVisible({ timeout: 30_000 });
    });
  }
});

test.describe("instant nav: admin initial loads", () => {
  const routes = [
    { path: "/dashboard", title: "Dashboard" },
    { path: "/dashboard/parcels", title: "Parcels" },
    { path: "/dashboard/settings", title: "Settings" },
  ];

  for (const route of routes) {
    test(`${route.path}: shell is served under instant()`, async ({ page, baseURL }) => {
      const url = new URL(route.path, baseURL).toString();

      await instant(
        page,
        async () => {
          await page.goto(url);
          await expect(page.locator(SHELL_MARKER)).toContainText(route.title);
          await expect(page.locator(PAGE_LOADING)).toBeVisible();
          await expect(page.locator(DYNAMIC_CONTENT)).toHaveCount(0);
        },
        { baseURL },
      );

      await page.reload();
      await expect(page.locator(DYNAMIC_CONTENT)).toBeVisible({ timeout: 30_000 });
    });
  }
});
