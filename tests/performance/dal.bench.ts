import path from "node:path";

import { db, closeDatabase } from "@/db";
import { listMerchants } from "@/features/merchants/server/dal";
import {
  getParcelSummary,
  listMerchantParcelsPageForUser,
  listParcels,
  listParcelsForRiderUser,
} from "@/features/parcels/server/dal";
import {
  listEligibleRiderPayoutRiders,
  listRiderPayouts,
} from "@/features/rider-payouts/server/dal";
import { recomputeParcelRiderPayoutStatuses } from "@/features/rider-payouts/server/utils";
import { listRiders } from "@/features/riders/server/dal";
import {
  listEligibleSettlementMerchants,
  listPendingRiderCashHandovers,
  listSettlements,
} from "@/features/settlements/server/dal";
import { listTownships } from "@/features/townships/server/dal";
import { listBankAccountsForUser, listUsers } from "@/features/users/server/dal";

import { readPerfContext } from "./context";
import { runPerfScript } from "./exit";
import {
  type DalBenchmarkResult,
  getOrCreateResultDir,
  measureAsync,
  writeJson,
  writeManifest,
} from "./report";

async function main() {
  const context = await readPerfContext();
  const resultDir = await getOrCreateResultDir();
  const results: DalBenchmarkResult[] = [];

  try {
    const benchmarks: Array<{
      name: string;
      run: () => Promise<unknown>;
      rowCount?: (result: unknown) => number;
    }> = [
      { name: "listParcels", run: async () => listParcels() },
      {
        name: "adminParcelsPageDataLoad",
        run: async () =>
          Promise.all([listParcels(), listMerchants(), listRiders(), listTownships()]),
        rowCount: (result) => sumLoadedRows(result),
      },
      {
        name: "listMerchantParcelsPageForUser",
        run: async () =>
          listMerchantParcelsPageForUser(context.merchantUserId, {
            searchTerm: "",
            createdOn: null,
            status: "all",
            page: 1,
            pageSize: 10,
          }),
      },
      { name: "getParcelSummary", run: async () => getParcelSummary() },
      {
        name: "dashboardPageDataLoad",
        run: async () =>
          Promise.all([
            getParcelSummary(),
            listEligibleSettlementMerchants(),
            listPendingRiderCashHandovers(),
          ]),
        rowCount: (result) => sumLoadedRows(result),
      },
      {
        name: "listEligibleSettlementMerchants",
        run: async () => listEligibleSettlementMerchants(),
      },
      {
        name: "listPendingRiderCashHandovers",
        run: async () => listPendingRiderCashHandovers(),
      },
    ];

    if (context.riderUserIds[0]) {
      const riderUserId = context.riderUserIds[0];
      benchmarks.push({
        name: "listParcelsForRiderUser",
        run: async () => listParcelsForRiderUser(riderUserId),
      });
    }

    benchmarks.push(
      { name: "listMerchants", run: async () => listMerchants() },
      { name: "listRiders", run: async () => listRiders() },
      { name: "listTownships", run: async () => listTownships() },
      { name: "listUsers", run: async () => listUsers() },
      {
        name: "usersPageBankAccountsLoad",
        run: async () => {
          const users = await listUsers();
          const bankAccounts = await Promise.all(
            users.map(async (user) => listBankAccountsForUser(user.id)),
          );
          return { users, bankAccounts };
        },
        rowCount: (result) => {
          if (!result || typeof result !== "object" || !("users" in result)) {
            return 0;
          }

          const users = result.users;
          return Array.isArray(users) ? users.length : 0;
        },
      },
      { name: "listSettlements", run: async () => listSettlements() },
      { name: "listRiderPayouts", run: async () => listRiderPayouts() },
      { name: "listEligibleRiderPayoutRiders", run: async () => listEligibleRiderPayoutRiders() },
    );

    if (context.recomputeParcelIds.length > 0) {
      benchmarks.push({
        name: "recomputeParcelRiderPayoutStatuses",
        run: async () => {
          await db.transaction(async (tx) => {
            await recomputeParcelRiderPayoutStatuses(tx, context.recomputeParcelIds);
          });
          return context.recomputeParcelIds.length;
        },
        rowCount: () => context.recomputeParcelIds.length,
      });
    }

    for (const benchmark of benchmarks) {
      console.log(`Benchmarking ${benchmark.name}...`);
      const measured = await measureAsync(benchmark.run);
      const rowCount = benchmark.rowCount
        ? benchmark.rowCount(measured.result)
        : getBenchmarkRowCount(measured.result);

      results.push({
        name: benchmark.name,
        rowCount,
        stats: measured.stats,
      });
    }

    await writeJson(path.join(resultDir, "dal.json"), {
      context: {
        perfScale: context.perfScale,
        perfSeed: context.perfSeed,
        parcelCount: context.parcelCount,
      },
      results,
    });

    const manifest = await writeManifest(resultDir, {
      commands: ["perf:dal"],
      perfScale: context.perfScale,
      perfSeed: context.perfSeed,
    });

    console.log(`DAL benchmarks written to ${resultDir}`);
    for (const result of results) {
      console.log(
        `${result.name}: p50=${result.stats.p50.toFixed(2)}ms p95=${result.stats.p95.toFixed(2)}ms rows=${result.rowCount}`,
      );
    }
    console.log(`Manifest: ${manifest.gitCommit ?? "unknown commit"}`);
  } finally {
    await closeDatabase();
  }
}

runPerfScript(main);

function getBenchmarkRowCount(result: unknown) {
  if (Array.isArray(result)) {
    return result.length;
  }

  if (result && typeof result === "object") {
    if ("parcels" in result && Array.isArray(result.parcels)) {
      return result.parcels.length;
    }

    if ("totalParcels" in result && typeof result.totalParcels === "number") {
      return result.totalParcels;
    }

    if ("users" in result && Array.isArray(result.users)) {
      return result.users.length;
    }
  }

  return 0;
}

function sumLoadedRows(result: unknown) {
  if (!Array.isArray(result)) {
    return 0;
  }

  return result.reduce((total, entry) => total + getBenchmarkRowCount(entry), 0);
}
