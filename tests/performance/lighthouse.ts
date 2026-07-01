import { spawn } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";

import { getOrCreateResultDir, parseJsonContents, writeJson, writeManifest } from "./report";
import { runPerfScript } from "./exit";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const auditTimeoutMs = Number(process.env.LIGHTHOUSE_AUDIT_TIMEOUT_MS ?? 120_000);
const maxWaitForLoadMs = Number(process.env.LIGHTHOUSE_MAX_WAIT_FOR_LOAD_MS ?? 60_000);
const pauseBetweenAuditsMs = Number(process.env.LIGHTHOUSE_PAUSE_BETWEEN_AUDITS_MS ?? 2_000);

type LighthouseRouteResult = {
  route: string;
  formFactor: "mobile" | "desktop";
  performanceScore: number | null;
  lcpMs: number | null;
  tbtMs: number | null;
  cls: number | null;
  error?: string;
};

type LighthouseReport = {
  categories?: {
    performance?: { score?: number | null };
  };
  audits?: Record<
    string,
    {
      numericValue?: number | null;
    }
  >;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLighthouseReport(value: unknown): value is LighthouseReport {
  if (!isRecord(value)) {
    return false;
  }

  if ("categories" in value && value.categories !== undefined && !isRecord(value.categories)) {
    return false;
  }

  if ("audits" in value && value.audits !== undefined && !isRecord(value.audits)) {
    return false;
  }

  return true;
}

async function runLighthouseCli(
  url: string,
  options: {
    formFactor: "mobile" | "desktop";
    outputPath: string;
  },
): Promise<LighthouseRouteResult> {
  const routePath = new URL(url).pathname;
  console.log(`Starting Lighthouse for ${routePath} (${options.formFactor})...`);

  const args = [
    url,
    "--output=json",
    `--output-path=${options.outputPath}`,
    "--only-categories=performance",
    "--quiet",
    `--max-wait-for-load=${maxWaitForLoadMs}`,
    "--chrome-flags=--headless --disable-gpu --no-sandbox --no-first-run --no-default-browser-check",
  ];

  if (options.formFactor === "desktop") {
    args.push("--preset=desktop");
  } else {
    args.push("--form-factor=mobile");
  }

  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn("bunx", ["lighthouse", ...args], {
      cwd: path.resolve(import.meta.dir, "../.."),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timeoutId = setTimeout(() => {
      child.kill("SIGTERM");
      reject(
        new Error(
          `Lighthouse audit for ${routePath} (${options.formFactor}) timed out after ${auditTimeoutMs}ms`,
        ),
      );
    }, auditTimeoutMs);

    child.on("error", (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeoutId);
      if (code === 0) {
        resolve(0);
        return;
      }

      reject(
        new Error(
          `Lighthouse CLI exited with code ${code ?? "unknown"} for ${routePath} (${options.formFactor})${stderr ? `: ${stderr.trim()}` : ""}`,
        ),
      );
    });
  });

  if (exitCode !== 0) {
    throw new Error(`Unexpected Lighthouse exit code ${exitCode}`);
  }

  const reportPath = `${options.outputPath}.report.json`;
  const directPath = options.outputPath;
  let reportContents: string;

  try {
    reportContents = await readFile(reportPath, "utf8");
    await unlink(reportPath).catch(() => undefined);
  } catch {
    reportContents = await readFile(directPath, "utf8");
    await unlink(directPath).catch(() => undefined);
  }

  const parsed = parseJsonContents(reportContents);

  if (!isLighthouseReport(parsed)) {
    throw new Error(`Lighthouse report at ${options.outputPath} is invalid.`);
  }

  const report = parsed;

  const audits = report.audits;
  const performanceScore = report.categories?.performance?.score ?? null;

  return {
    route: routePath,
    formFactor: options.formFactor,
    performanceScore: performanceScore === null ? null : performanceScore * 100,
    lcpMs: audits?.["largest-contentful-paint"]?.numericValue ?? null,
    tbtMs: audits?.["total-blocking-time"]?.numericValue ?? null,
    cls: audits?.["cumulative-layout-shift"]?.numericValue ?? null,
  };
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main() {
  const resultDir = await getOrCreateResultDir();
  const routes = ["/login"];
  const results: LighthouseRouteResult[] = [];
  const failures: string[] = [];

  for (const routePath of routes) {
    for (const formFactor of ["mobile", "desktop"] as const) {
      const url = `${baseURL}${routePath}`;
      const outputPath = path.join(
        resultDir,
        `lh-${routePath.replaceAll("/", "-").slice(1)}-${formFactor}`,
      );

      try {
        const result = await runLighthouseCli(url, { formFactor, outputPath });
        results.push(result);
        console.log(
          `${routePath} (${formFactor}): score=${result.performanceScore?.toFixed(0) ?? "n/a"} lcp=${result.lcpMs?.toFixed(0) ?? "n/a"}ms`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${routePath} (${formFactor}): ${message}`);
        results.push({
          route: routePath,
          formFactor,
          performanceScore: null,
          lcpMs: null,
          tbtMs: null,
          cls: null,
          error: message,
        });
        console.error(`Lighthouse failed for ${routePath} (${formFactor}): ${message}`);
      }

      await sleep(pauseBetweenAuditsMs);
    }
  }

  await writeJson(path.join(resultDir, "lighthouse.json"), {
    note: "Dashboard route timings are captured in pages.json; Lighthouse audits /login only.",
    results,
    failures,
  });
  await writeManifest(resultDir, { commands: ["perf:lighthouse"] });
  console.log(`Lighthouse results written to ${resultDir}`);

  if (failures.length > 0) {
    throw new Error(`Lighthouse completed with ${failures.length} failed audit(s).`);
  }
}

runPerfScript(main);
