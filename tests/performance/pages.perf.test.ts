import path from "node:path";

import type { Page, Locator } from "@playwright/test";

import { signIn } from "../e2e/helpers";
import { test, expect } from "../e2e/fixtures";
import { readPerfContext } from "./context";
import { getOrCreateResultDir, median, writeJson, writeManifest } from "./report";

type PageMetricSample = {
  ttfbMs: number | null;
  domContentLoadedMs: number | null;
  timeToContentMs: number;
};

type PageBenchmarkResult = {
  route: string;
  role: "super_admin" | "merchant" | "rider";
  runs: number;
  median: PageMetricSample;
  samples: PageMetricSample[];
};

const runsPerRoute = 3;

async function measureRoute(
  page: Page,
  route: string,
  getContentLocator: (page: Page) => Locator,
): Promise<PageMetricSample> {
  const startedAt = Date.now();
  const response = await page.goto(route, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(route)}(?:\\?.*)?$`), {
    timeout: 60_000,
  });

  const ttfbMs =
    response?.request().timing()?.responseStart !== undefined
      ? response.request().timing().responseStart
      : null;

  const domContentLoadedMs = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    return navigation instanceof PerformanceNavigationTiming
      ? navigation.domContentLoadedEventEnd
      : null;
  });

  await expect(getContentLocator(page)).toBeVisible({ timeout: 60_000 });
  const timeToContentMs = Date.now() - startedAt;

  return {
    ttfbMs,
    domContentLoadedMs,
    timeToContentMs,
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function summarizeSamples(samples: PageMetricSample[]): PageMetricSample {
  return {
    ttfbMs: median(samples.map((sample) => sample.ttfbMs ?? 0)),
    domContentLoadedMs: median(samples.map((sample) => sample.domContentLoadedMs ?? 0)),
    timeToContentMs: median(samples.map((sample) => sample.timeToContentMs)),
  };
}

test.describe("dashboard page performance", () => {
  test("captures page load metrics for key routes", async ({ page }) => {
    const perfContext = await readPerfContext();
    const resultDir = await getOrCreateResultDir();
    const results: PageBenchmarkResult[] = [];

    const scenarios: Array<{
      route: string;
      role: PageBenchmarkResult["role"];
      user: { username: string; password: string };
      getContentLocator: (page: Page) => Locator;
    }> = [
      {
        route: "/dashboard",
        role: "super_admin",
        user: perfContext.users.superAdmin,
        getContentLocator: (currentPage) => currentPage.getByText("Total Parcels", { exact: true }),
      },
      {
        route: "/dashboard/parcels",
        role: "super_admin",
        user: perfContext.users.superAdmin,
        getContentLocator: (currentPage) =>
          currentPage.getByRole("button", { name: /create parcel/i }),
      },
      {
        route: "/dashboard/users",
        role: "super_admin",
        user: perfContext.users.superAdmin,
        getContentLocator: (currentPage) => currentPage.getByRole("columnheader", { name: "Name" }),
      },
      {
        route: "/dashboard/merchant/parcels",
        role: "merchant",
        user: perfContext.users.merchant,
        getContentLocator: (currentPage) =>
          currentPage.getByPlaceholder("Search recipient name or phone number"),
      },
      {
        route: "/dashboard/merchant/overview",
        role: "merchant",
        user: perfContext.users.merchant,
        getContentLocator: (currentPage) =>
          currentPage.getByRole("heading", { name: "Settlement History" }),
      },
      {
        route: "/dashboard/rider/parcels",
        role: "rider",
        user: perfContext.users.rider,
        getContentLocator: (currentPage) => currentPage.getByRole("tab", { name: "To Deliver" }),
      },
      {
        route: "/dashboard/rider-payouts",
        role: "super_admin",
        user: perfContext.users.superAdmin,
        getContentLocator: (currentPage) => currentPage.getByRole("columnheader", { name: "Code" }),
      },
      {
        route: "/dashboard/settlements",
        role: "super_admin",
        user: perfContext.users.superAdmin,
        getContentLocator: (currentPage) =>
          currentPage.getByRole("heading", { name: "Merchant Settlements" }),
      },
    ];

    for (const scenario of scenarios) {
      console.log(`Measuring ${scenario.route} as ${scenario.role}...`);
      await signIn(page, scenario.user);
      const samples: PageMetricSample[] = [];

      for (let run = 0; run < runsPerRoute; run++) {
        console.log(`  run ${run + 1}/${runsPerRoute}`);
        samples.push(await measureRoute(page, scenario.route, scenario.getContentLocator));
      }

      results.push({
        route: scenario.route,
        role: scenario.role,
        runs: runsPerRoute,
        median: summarizeSamples(samples),
        samples,
      });
    }

    await writeJson(path.join(resultDir, "pages.json"), { results });
    await writeManifest(resultDir, { commands: ["perf:pages"] });

    for (const result of results) {
      console.log(
        `${result.route}: median timeToContent=${result.median.timeToContentMs.toFixed(0)}ms ttfb=${result.median.ttfbMs?.toFixed(0) ?? "n/a"}ms`,
      );
    }
  });
});
