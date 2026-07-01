import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

function getModuleDir() {
  if (typeof import.meta.dir === "string") {
    return import.meta.dir;
  }

  return path.dirname(fileURLToPath(import.meta.url));
}

function getRuntimeVersion() {
  if (typeof Bun !== "undefined" && typeof Bun.version === "string") {
    return Bun.version;
  }

  return process.version;
}

async function runGitRevParseHead(cwd: string) {
  if (typeof Bun !== "undefined" && typeof Bun.spawn === "function") {
    const proc = Bun.spawn(["git", "rev-parse", "HEAD"], {
      cwd,
      stdout: "pipe",
      stderr: "ignore",
    });
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      return null;
    }

    return (await new Response(proc.stdout).text()).trim() || null;
  }

  return new Promise<string | null>((resolve) => {
    const child = spawn("git", ["rev-parse", "HEAD"], {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
    });

    let stdout = "";
    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.on("error", () => resolve(null));
    child.on("close", (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }

      const trimmed = stdout.trim();
      resolve(trimmed.length > 0 ? trimmed : null);
    });
  });
}

export type PercentileStats = {
  min: number;
  max: number;
  p50: number;
  p95: number;
  mean: number;
  samples: number;
};

export type DalBenchmarkResult = {
  name: string;
  rowCount: number;
  stats: PercentileStats;
};

export type Manifest = {
  runId: string;
  createdAt: string;
  gitCommit: string | null;
  bunVersion: string;
  perfScale: string;
  perfSeed: string;
  commands: string[];
  resultDir: string;
};

const projectRoot = path.resolve(getModuleDir(), "../..");
const resultsRoot = path.join(projectRoot, "benchmarks/results");
const lastRunFile = path.join(projectRoot, "benchmarks/.last-run");

let cachedResultDir: string | null = null;

export function getProjectRoot() {
  return projectRoot;
}

export async function getOrCreateResultDir(): Promise<string> {
  if (cachedResultDir) {
    return cachedResultDir;
  }

  if (process.env.PERF_RESULT_DIR) {
    cachedResultDir = path.resolve(process.env.PERF_RESULT_DIR);
    await mkdir(cachedResultDir, { recursive: true });
    return cachedResultDir;
  }

  const runId = new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replace(/\.\d{3}Z$/, "Z");
  cachedResultDir = path.join(resultsRoot, runId);
  await mkdir(cachedResultDir, { recursive: true });
  await writeFile(lastRunFile, `${cachedResultDir}\n`, "utf8");
  process.env.PERF_RESULT_DIR = cachedResultDir;

  return cachedResultDir;
}

export async function readLastResultDir(): Promise<string | null> {
  try {
    const contents = await readFile(lastRunFile, "utf8");
    const trimmed = contents.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

export function computePercentileStats(samples: number[]): PercentileStats {
  if (samples.length === 0) {
    return { min: 0, max: 0, p50: 0, p95: 0, mean: 0, samples: 0 };
  }

  const sorted = [...samples].toSorted((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);

  return {
    min: sorted[0] ?? 0,
    max: sorted.at(-1) ?? 0,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    mean: sum / sorted.length,
    samples: sorted.length,
  };
}

function percentile(sorted: number[], p: number) {
  const index = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))] ?? 0;
}

export async function measureAsync<T>(
  fn: () => Promise<T>,
  options: { warmup?: number; iterations?: number } = {},
): Promise<{ result: T; stats: PercentileStats }> {
  const warmup = options.warmup ?? 3;
  const iterations = options.iterations ?? 20;

  for (let i = 0; i < warmup; i++) {
    await fn();
  }

  const samples: number[] = [];
  let lastResult: T | undefined;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    lastResult = await fn();
    samples.push(performance.now() - start);
  }

  if (lastResult === undefined) {
    throw new Error("Benchmark function did not return a result.");
  }

  return {
    result: lastResult,
    stats: computePercentileStats(samples),
  };
}

export async function getGitCommitSha(): Promise<string | null> {
  try {
    return await runGitRevParseHead(projectRoot);
  } catch {
    return null;
  }
}

export async function writeManifest(
  resultDir: string,
  overrides: Partial<Manifest> & Pick<Manifest, "commands">,
): Promise<Manifest> {
  const existingRaw = await readJsonFile(path.join(resultDir, "manifest.json"));
  const existing = isManifest(existingRaw) ? existingRaw : null;
  const manifest: Manifest = {
    runId: path.basename(resultDir),
    createdAt: new Date().toISOString(),
    gitCommit: await getGitCommitSha(),
    bunVersion: getRuntimeVersion(),
    perfScale: process.env.PERF_SCALE ?? "small",
    perfSeed: process.env.PERF_SEED ?? "42",
    resultDir,
    ...existing,
    ...overrides,
    commands: [...(existing?.commands ?? []), ...overrides.commands],
  };

  await writeJson(path.join(resultDir, "manifest.json"), manifest);
  return manifest;
}

export async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPercentileStats(value: unknown): value is PercentileStats {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.min === "number" &&
    typeof value.max === "number" &&
    typeof value.p50 === "number" &&
    typeof value.p95 === "number" &&
    typeof value.mean === "number" &&
    typeof value.samples === "number"
  );
}

export function isDalBenchmarkResult(value: unknown): value is DalBenchmarkResult {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.name === "string" &&
    typeof value.rowCount === "number" &&
    isPercentileStats(value.stats)
  );
}

function isManifest(value: unknown): value is Manifest {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.runId === "string" && Array.isArray(value.commands);
}

export function parseJsonContents(contents: string): unknown {
  const parsed: unknown = JSON.parse(contents);
  return parsed;
}

export async function readJsonFile(filePath: string): Promise<unknown> {
  try {
    const contents = await readFile(filePath, "utf8");
    return parseJsonContents(contents);
  } catch {
    return null;
  }
}

export function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  }

  return sorted[middle] ?? 0;
}
