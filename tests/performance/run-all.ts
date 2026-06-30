import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

import { getOrCreateResultDir, writeManifest } from "./report";
import { logStepDone, logStepStart } from "./progress";
import { runPerfScript } from "./exit";

const projectRoot = path.resolve(import.meta.dir, "../..");
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

type PerfStep = {
  label: string;
  command: string;
  args: string[];
};

const steps: PerfStep[] = [
  {
    label: "Seeding database",
    command: "bun",
    args: ["run", "perf:seed"],
  },
  {
    label: "Running DAL benchmarks",
    command: "bun",
    args: ["--env-file=.env.test", "tests/performance/dal.bench.ts"],
  },
  {
    label: "Capturing EXPLAIN snapshots",
    command: "bun",
    args: ["--env-file=.env.test", "tests/performance/explain.ts"],
  },
  {
    label: "Running Playwright page benchmarks (includes production build)",
    command: "bun",
    args: ["run", "perf:pages"],
  },
  {
    label: "Running Lighthouse audits",
    command: "bun",
    args: ["run", "perf:lighthouse"],
  },
];

async function runCommand(command: string, args: string[], env: Record<string, string>) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: { ...process.env, ...env },
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function waitForServer(url: string, timeoutMs: number) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.ok || response.status < 500) {
        return;
      }
    } catch {
      // Server is still starting.
    }

    await Bun.sleep(1_000);
  }

  throw new Error(`Timed out waiting for server at ${url}`);
}

async function startProductionServer(): Promise<ChildProcess> {
  const child = spawn(
    "bun",
    [
      "--env-file=.env.test",
      "run",
      "start",
      "--",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        BETTER_AUTH_URL: baseURL,
        NODE_ENV: "production",
      },
      stdio: "ignore",
    },
  );

  await waitForServer(baseURL, 120_000);
  return child;
}

function stopProductionServer(child: ChildProcess) {
  if (!child.killed) {
    child.kill("SIGTERM");
  }
}

async function main() {
  const resultDir = await getOrCreateResultDir();
  const env = { PERF_RESULT_DIR: resultDir };
  const perfScale = process.env.PERF_SCALE ?? "small";
  const perfSeed = process.env.PERF_SEED ?? "42";
  const totalSteps = steps.length;
  const runStartedAt = Date.now();

  console.log("Performance benchmark run started");
  console.log(`Scale: ${perfScale} | Seed: ${perfSeed}`);
  console.log(`Results: ${resultDir}`);

  await writeManifest(resultDir, {
    commands: ["perf:all"],
    perfScale,
    perfSeed,
  });

  const skipLighthouse = process.env.PERF_SKIP_LIGHTHOUSE === "1";
  const strictLighthouse = process.env.PERF_STRICT_LIGHTHOUSE === "1";

  for (const [index, step] of steps.entries()) {
    const stepNumber = index + 1;
    const startedAt = Date.now();
    logStepStart(stepNumber, totalSteps, step.label);

    if (step.label.startsWith("Running Lighthouse") && skipLighthouse) {
      console.log("Skipping Lighthouse audits (PERF_SKIP_LIGHTHOUSE=1).");
      logStepDone(stepNumber, totalSteps, step.label, startedAt);
      continue;
    }

    try {
      if (step.label.startsWith("Running Lighthouse")) {
        // Playwright's webServer may still be releasing port 3100.
        await Bun.sleep(3_000);

        const server = await startProductionServer();
        try {
          await runCommand(step.command, step.args, env);
        } finally {
          stopProductionServer(server);
        }
      } else {
        await runCommand(step.command, step.args, env);
      }
    } catch (error) {
      if (step.label.startsWith("Running Lighthouse") && !strictLighthouse) {
        console.warn(
          "Lighthouse step failed but perf:all will continue. Set PERF_STRICT_LIGHTHOUSE=1 to fail the run. Steps 1-4 results are still valid.",
        );
        console.warn(error instanceof Error ? error.message : String(error));
        logStepDone(stepNumber, totalSteps, `${step.label} (with errors)`, startedAt);
        continue;
      }

      throw error;
    }

    logStepDone(stepNumber, totalSteps, step.label, startedAt);
  }

  const totalSeconds = ((Date.now() - runStartedAt) / 1000).toFixed(1);
  console.log(`\nPerformance run complete in ${totalSeconds}s`);
  console.log(`Results saved to: ${resultDir}`);
}

runPerfScript(main);
