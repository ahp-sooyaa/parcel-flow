import { describe, expect, test } from "bun:test";

import {
  calculatePercentUsed,
  deriveCloudflareTotalStorageBytes,
  getDefaultSupabaseReferenceBytes,
  parsePrometheusMetrics,
  selectSupabaseDatabaseUsageBytes,
} from "@/features/dashboard/server/utils";

describe("dashboard storage utils", () => {
  test("parses prometheus metrics and selects supabase database usage bytes", () => {
    const metrics = parsePrometheusMetrics(`
# HELP pg_database_size_bytes Size of each database
pg_database_size_bytes{supabase_project_ref="ref",datname="template1"} 7.752851e+06
pg_database_size_bytes{supabase_project_ref="ref",datname="postgres"} 1.1291795e+07
`);

    expect(selectSupabaseDatabaseUsageBytes(metrics)).toBe(11_291_795);
    expect(getDefaultSupabaseReferenceBytes()).toBe(500 * 1000 * 1000);
  });

  test("derives cloudflare total storage bytes from payload and metadata", () => {
    expect(
      deriveCloudflareTotalStorageBytes({
        max: {
          payloadSize: 10_000,
          metadataSize: 500,
        },
      }),
    ).toBe(10_500);
    expect(deriveCloudflareTotalStorageBytes(null)).toBeNull();
  });

  test("clamps percentage usage to 100", () => {
    expect(calculatePercentUsed(50, 100)).toBe(50);
    expect(calculatePercentUsed(150, 100)).toBe(100);
  });
});
