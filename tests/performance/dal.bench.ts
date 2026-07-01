import path from "node:path";

import { db, closeDatabase } from "@/db";
import { listMerchantOptions, listMerchants } from "@/features/merchants/server/dal";
import {
  getParcelSummary,
  listAdminParcelsPage,
  listMerchantParcelsPageForUser,
  listRiderParcelsPageForUser,
} from "@/features/parcels/server/dal";
import { adminParcelPageSize, riderParcelPageSize } from "@/features/parcels/server/dto";
import {
  listEligibleRiderPayoutRiderSummaries,
  listRiderPayoutsPage,
} from "@/features/rider-payouts/server/dal";
import { riderPayoutListPageSize } from "@/features/rider-payouts/server/dto";
import { recomputeParcelRiderPayoutStatuses } from "@/features/rider-payouts/server/utils";
import { listRiderOptions, listRiders } from "@/features/riders/server/dal";
import {
  getSettlementWorkspaceSummary,
  listEligibleSettlementMerchants,
  listPendingRiderCashHandovers,
  listSettlementsPage,
} from "@/features/settlements/server/dal";
import { settlementListPageSize } from "@/features/settlements/server/dto";
import { listTownships } from "@/features/townships/server/dal";
import { listBankAccountsForUserIds, listUsersPage } from "@/features/users/server/dal";
import { userListPageSize } from "@/features/users/server/dto";

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
      {
        name: "listAdminParcelsPage",
        run: async () =>
          listAdminParcelsPage({
            searchTerm: "",
            assignment: "all",
            townshipName: null,
            statuses: [],
            page: 1,
            pageSize: adminParcelPageSize,
          }),
      },
      {
        name: "adminParcelsPageDataLoad",
        run: async () =>
          Promise.all([
            listAdminParcelsPage({
              searchTerm: "",
              assignment: "all",
              townshipName: null,
              statuses: [],
              page: 1,
              pageSize: adminParcelPageSize,
            }),
            listMerchantOptions(),
            listRiderOptions(),
            listTownships(),
          ]),
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
        run: async () => Promise.all([getParcelSummary(), getSettlementWorkspaceSummary()]),
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
        name: "listRiderParcelsPageForUser",
        run: async () =>
          listRiderParcelsPageForUser(riderUserId, {
            searchTerm: "",
            tab: "to_deliver",
            townshipName: null,
            statuses: [],
            page: 1,
            pageSize: riderParcelPageSize,
          }),
      });
    }

    benchmarks.push(
      { name: "listMerchants", run: async () => listMerchants() },
      { name: "listRiders", run: async () => listRiders() },
      { name: "listTownships", run: async () => listTownships() },
      {
        name: "listUsers",
        run: async () => listUsersPage({ searchTerm: "", page: 1, pageSize: userListPageSize }),
        rowCount: (result) =>
          result && typeof result === "object" && "users" in result && Array.isArray(result.users)
            ? result.users.length
            : 0,
      },
      {
        name: "usersPageDataLoad",
        run: async () => {
          const pageResult = await listUsersPage({
            searchTerm: "",
            page: 1,
            pageSize: userListPageSize,
          });
          const bankAccountsByUserId = await listBankAccountsForUserIds(
            pageResult.users.map((user) => user.id),
          );
          return { pageResult, bankAccountsByUserId };
        },
        rowCount: (result) => {
          if (!result || typeof result !== "object" || !("pageResult" in result)) {
            return 0;
          }

          const pageResult = result.pageResult;
          if (
            !pageResult ||
            typeof pageResult !== "object" ||
            !("users" in pageResult) ||
            !Array.isArray(pageResult.users)
          ) {
            return 0;
          }

          return pageResult.users.length;
        },
      },
      {
        name: "listSettlements",
        run: async () => listSettlementsPage({ page: 1, pageSize: settlementListPageSize }),
        rowCount: (result) =>
          result &&
          typeof result === "object" &&
          "settlements" in result &&
          Array.isArray(result.settlements)
            ? result.settlements.length
            : 0,
      },
      {
        name: "listRiderPayouts",
        run: async () => listRiderPayoutsPage({ page: 1, pageSize: riderPayoutListPageSize }),
        rowCount: (result) =>
          result &&
          typeof result === "object" &&
          "payouts" in result &&
          Array.isArray(result.payouts)
            ? result.payouts.length
            : 0,
      },
      {
        name: "listEligibleRiderPayoutRiders",
        run: async () => listEligibleRiderPayoutRiderSummaries(),
        rowCount: (result) => (Array.isArray(result) ? result.length : 0),
      },
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
