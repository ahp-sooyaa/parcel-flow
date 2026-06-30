import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getProjectRoot } from "./report";

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
  return JSON.parse(contents) as PerfSeedContext;
}
