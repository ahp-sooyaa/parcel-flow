import path from "node:path";
import type postgres from "postgres";

import { closeDatabase } from "@/db";
import { adminParcelPageSize, riderParcelPageSize } from "@/features/parcels/server/dto";

import { closeTestDatabase, createTestDatabase } from "../fixtures/db";
import { readPerfContext } from "./context";
import { runPerfScript } from "./exit";
import {
  buildAdminParcelsPageQuery,
  buildEligibleSettlementFinancialItemsQuery,
  buildGetParcelSummaryQuery,
  buildMerchantParcelsPageQuery,
  buildMerchantsParcelAggregationQuery,
  buildPendingRiderCashHandoversQuery,
  buildRiderParcelsPageQuery,
  buildRidersParcelAggregationQuery,
} from "./queries";
import { getOrCreateResultDir, writeJson, writeManifest } from "./report";

type ExplainSnapshot = {
  name: string;
  sql: string;
  params: unknown[];
  plan: unknown;
};

type ExplainSqlParam = postgres.ParameterOrJSON<postgres.JSONValue>;

function isExplainSqlParam(value: unknown): value is ExplainSqlParam {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint" ||
    value instanceof Date ||
    Array.isArray(value) ||
    typeof value === "object"
  );
}

function toExplainSqlParams(params: unknown[]): ExplainSqlParam[] {
  const sqlParams: ExplainSqlParam[] = [];

  for (const param of params) {
    if (!isExplainSqlParam(param)) {
      throw new Error(`Unsupported SQL parameter: ${typeof param}`);
    }

    sqlParams.push(param);
  }

  return sqlParams;
}

async function main() {
  const context = await readPerfContext();
  const resultDir = await getOrCreateResultDir();
  const { client } = createTestDatabase();
  const explainClient: postgres.Sql<Record<string, postgres.JSONValue>> = client;
  const snapshots: ExplainSnapshot[] = [];

  try {
    const queries = [
      {
        name: "listAdminParcelsPage",
        ...buildAdminParcelsPageQuery(adminParcelPageSize).toSQL(),
      },
      {
        name: "listMerchantParcelsPageForUser",
        ...buildMerchantParcelsPageQuery(context.merchantUserId, {
          searchTerm: "",
          createdOn: null,
          status: "all",
          page: 1,
          pageSize: 10,
        }).toSQL(),
      },
      {
        name: "getParcelSummary",
        ...buildGetParcelSummaryQuery().toSQL(),
      },
      {
        name: "listMerchantsParcelAggregation",
        ...buildMerchantsParcelAggregationQuery().toSQL(),
      },
      {
        name: "listRidersParcelAggregation",
        ...buildRidersParcelAggregationQuery().toSQL(),
      },
      {
        name: "listEligibleSettlementFinancialItems",
        ...buildEligibleSettlementFinancialItemsQuery().toSQL(),
      },
      {
        name: "listPendingRiderCashHandovers",
        ...buildPendingRiderCashHandoversQuery().toSQL(),
      },
    ];

    const riderUserId = context.riderUserIds[0];
    if (riderUserId) {
      queries.push({
        name: "listRiderParcelsPageForUser",
        ...buildRiderParcelsPageQuery(riderUserId, riderParcelPageSize).toSQL(),
      });
    }

    for (const query of queries) {
      console.log(`Running EXPLAIN ANALYZE for ${query.name}...`);
      const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query.sql}`;
      const rows = await explainClient.unsafe(explainSql, toExplainSqlParams(query.params));
      const plan = rows[0]?.["QUERY PLAN"] ?? rows[0];
      console.log(`Finished EXPLAIN ANALYZE for ${query.name}.`);

      snapshots.push({
        name: query.name,
        sql: query.sql,
        params: query.params,
        plan,
      });

      await writeJson(path.join(resultDir, `explain-${query.name}.json`), {
        name: query.name,
        sql: query.sql,
        params: query.params,
        plan,
      });
    }

    await writeJson(path.join(resultDir, "explain.json"), { snapshots });
    await writeManifest(resultDir, {
      commands: ["perf:explain"],
      perfScale: context.perfScale,
      perfSeed: context.perfSeed,
    });

    console.log(`EXPLAIN snapshots written to ${resultDir}`);
    for (const snapshot of snapshots) {
      console.log(`- explain-${snapshot.name}.json`);
    }
  } finally {
    await closeTestDatabase(client);
    await closeDatabase();
  }
}

runPerfScript(main);
