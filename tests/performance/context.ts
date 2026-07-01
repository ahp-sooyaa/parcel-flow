import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getProjectRoot, parseJsonContents } from "./report";

export type PerfSeedUserCredentials = {
  username: string;
  password: string;
};

export type PerfSeedContext = {
  perfSeed: string;
  perfScale: string;
  parcelCount: number;
  superAdminUserId: string;
  merchantUserId: string;
  merchantId: string;
  riderUserIds: string[];
  riderIds: string[];
  townshipIds: string[];
  recomputeParcelIds: string[];
  users: {
    superAdmin: PerfSeedUserCredentials;
    merchant: PerfSeedUserCredentials;
    rider: PerfSeedUserCredentials;
  };
};

const contextPath = path.join(getProjectRoot(), "benchmarks/.perf-context.json");

export async function writePerfContext(context: PerfSeedContext) {
  await writeFile(contextPath, `${JSON.stringify(context, null, 2)}\n`, "utf8");
}

export async function readPerfContext(): Promise<PerfSeedContext> {
  const contents = await readFile(contextPath, "utf8");
  const parsed = parseJsonContents(contents);

  if (!isPerfSeedContext(parsed)) {
    throw new Error("Performance seed context file is invalid.");
  }

  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPerfSeedUserCredentials(value: unknown): value is PerfSeedUserCredentials {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.username === "string" && typeof value.password === "string";
}

function isPerfSeedContext(value: unknown): value is PerfSeedContext {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.perfSeed === "string" &&
    typeof value.perfScale === "string" &&
    typeof value.parcelCount === "number" &&
    typeof value.superAdminUserId === "string" &&
    typeof value.merchantUserId === "string" &&
    typeof value.merchantId === "string" &&
    Array.isArray(value.riderUserIds) &&
    Array.isArray(value.riderIds) &&
    Array.isArray(value.townshipIds) &&
    Array.isArray(value.recomputeParcelIds) &&
    isRecord(value.users) &&
    isPerfSeedUserCredentials(value.users.superAdmin) &&
    isPerfSeedUserCredentials(value.users.merchant) &&
    isPerfSeedUserCredentials(value.users.rider)
  );
}
