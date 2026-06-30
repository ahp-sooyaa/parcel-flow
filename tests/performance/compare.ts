import path from "node:path";
import { stat } from "node:fs/promises";

import { type DalBenchmarkResult, readJsonFile } from "./report";
import { runPerfScriptWithExitCode } from "./exit";

type CompareFile = {
  dal?: {
    results: DalBenchmarkResult[];
  };
  pages?: {
    results: Array<{
      route: string;
      median: { timeToContentMs: number; ttfbMs: number | null };
    }>;
  };
  lighthouse?: {
    results: Array<{
      route: string;
      formFactor: string;
      performanceScore: number | null;
      lcpMs: number | null;
    }>;
  };
};

const defaultThresholdPercent = Number(process.env.PERF_COMPARE_THRESHOLD ?? 10);

async function main() {
  const baselinePath = process.argv[2];
  const candidatePath = process.argv[3];

  if (!baselinePath || !candidatePath) {
    console.error(
      "Usage: bun tests/performance/compare.ts <baseline-dir-or-dal.json> <candidate-dir-or-dal.json>",
    );
    process.exit(1);
  }

  const baseline = await loadCompareFile(baselinePath);
  const candidate = await loadCompareFile(candidatePath);

  console.log(`Comparing baseline: ${baselinePath}`);
  console.log(`Against candidate: ${candidatePath}`);
  console.log(`Regression threshold: ${defaultThresholdPercent}%`);
  console.log("");

  let regressions = 0;

  if (baseline.dal && candidate.dal) {
    console.log("DAL benchmarks");
    const baselineMap = new Map(baseline.dal.results.map((result) => [result.name, result]));

    for (const result of candidate.dal.results) {
      const base = baselineMap.get(result.name);
      if (!base) {
        console.log(`- ${result.name}: new benchmark (no baseline)`);
        continue;
      }

      const delta = percentDelta(base.stats.p95, result.stats.p95);
      const flag = delta > defaultThresholdPercent ? "REGRESSION" : "ok";
      if (flag === "REGRESSION") {
        regressions += 1;
      }

      console.log(
        `- ${result.name}: baseline p95=${base.stats.p95.toFixed(2)}ms candidate p95=${result.stats.p95.toFixed(2)}ms delta=${delta.toFixed(1)}% [${flag}]`,
      );
    }

    console.log("");
  }

  if (baseline.pages && candidate.pages) {
    console.log("Page benchmarks");
    const baselineMap = new Map(baseline.pages.results.map((result) => [result.route, result]));

    for (const result of candidate.pages.results) {
      const base = baselineMap.get(result.route);
      if (!base) {
        console.log(`- ${result.route}: new benchmark (no baseline)`);
        continue;
      }

      const delta = percentDelta(base.median.timeToContentMs, result.median.timeToContentMs);
      const threshold = defaultThresholdPercent + 10;
      const flag = delta > threshold ? "REGRESSION" : "ok";
      if (flag === "REGRESSION") {
        regressions += 1;
      }

      console.log(
        `- ${result.route}: baseline=${base.median.timeToContentMs.toFixed(0)}ms candidate=${result.median.timeToContentMs.toFixed(0)}ms delta=${delta.toFixed(1)}% [${flag}]`,
      );
    }

    console.log("");
  }

  if (baseline.lighthouse && candidate.lighthouse) {
    console.log("Lighthouse benchmarks");
    const baselineMap = new Map(
      baseline.lighthouse.results.map((result) => [`${result.route}:${result.formFactor}`, result]),
    );

    for (const result of candidate.lighthouse.results) {
      const key = `${result.route}:${result.formFactor}`;
      const base = baselineMap.get(key);
      if (!base || base.lcpMs === null || result.lcpMs === null) {
        console.log(`- ${key}: skipped (missing baseline or LCP)`);
        continue;
      }

      const delta = percentDelta(base.lcpMs, result.lcpMs);
      const flag = delta > defaultThresholdPercent ? "REGRESSION" : "ok";
      if (flag === "REGRESSION") {
        regressions += 1;
      }

      console.log(
        `- ${key}: baseline LCP=${base.lcpMs.toFixed(0)}ms candidate LCP=${result.lcpMs.toFixed(0)}ms delta=${delta.toFixed(1)}% [${flag}]`,
      );
    }

    console.log("");
  }

  if (regressions > 0) {
    console.log(`${regressions} regression(s) exceeded threshold.`);
    process.exitCode = 1;
  } else {
    console.log("No regressions exceeded threshold.");
  }
}

function percentDelta(baseline: number, candidate: number) {
  if (baseline === 0) {
    return candidate === 0 ? 0 : 100;
  }

  return ((candidate - baseline) / baseline) * 100;
}

async function loadCompareFile(inputPath: string): Promise<CompareFile> {
  const resolved = path.resolve(inputPath);
  const direct = await readJsonFile<CompareFile | DalBenchmarkResult[]>(resolved);

  if (Array.isArray(direct)) {
    return { dal: { results: direct } };
  }

  if (direct && "results" in direct && Array.isArray(direct.results) && direct.results[0]?.stats) {
    return { dal: { results: direct.results as DalBenchmarkResult[] } };
  }

  if (direct && ("dal" in direct || "pages" in direct || "lighthouse" in direct)) {
    return direct;
  }

  const parentDir = (await isDirectory(resolved)) ? resolved : path.dirname(resolved);
  const dalFile = await readJsonFile<{ results: DalBenchmarkResult[] }>(
    path.join(parentDir, "dal.json"),
  );
  const dal = dalFile ? { results: dalFile.results } : undefined;
  const pages = await readJsonFile<CompareFile["pages"]>(path.join(parentDir, "pages.json"));
  const lighthouse = await readJsonFile<CompareFile["lighthouse"]>(
    path.join(parentDir, "lighthouse.json"),
  );

  return { dal, pages: pages ?? undefined, lighthouse: lighthouse ?? undefined };
}

async function isDirectory(targetPath: string) {
  try {
    const fileStat = await stat(targetPath);
    return fileStat.isDirectory();
  } catch {
    return false;
  }
}

runPerfScriptWithExitCode(main);
