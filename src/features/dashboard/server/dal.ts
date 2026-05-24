import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { z } from "zod";

import type { StorageMetricRowDto, StorageStatsCardDto } from "@/features/dashboard/server/dto";
import {
  createReadyStorageRow,
  createUnavailableStorageRow,
  deriveCloudflareTotalStorageBytes,
  getDefaultCloudflareR2ReferenceBytes,
  getDefaultSupabaseReferenceBytes,
  parsePrometheusMetrics,
  parseReferenceBytes,
  selectSupabaseDatabaseUsageBytes,
} from "@/features/dashboard/server/utils";

const cloudflareGraphqlResponseSchema = z.object({
  data: z
    .object({
      viewer: z
        .object({
          accounts: z.array(
            z.object({
              r2StorageAdaptiveGroups: z
                .array(
                  z.object({
                    max: z
                      .object({
                        payloadSize: z.number().nullable().optional(),
                        metadataSize: z.number().nullable().optional(),
                      })
                      .nullable()
                      .optional(),
                  }),
                )
                .optional(),
            }),
          ),
        })
        .optional(),
    })
    .optional(),
  errors: z.array(z.object({ message: z.string().optional() })).optional(),
});

function requireSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const explicitProjectId = process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID;

  if ((!supabaseUrl && !explicitProjectId) || !secretKey) {
    return null;
  }

  const projectId =
    explicitProjectId ?? (supabaseUrl ? new URL(supabaseUrl).hostname.split(".")[0] : null);

  if (!projectId) {
    return null;
  }

  return { projectId, secretKey };
}

function getCloudflareReferenceBytes() {
  return (
    parseReferenceBytes(process.env.CLOUDFLARE_R2_REFERENCE_BYTES) ??
    getDefaultCloudflareR2ReferenceBytes()
  );
}

function getSupabaseReferenceBytes() {
  return (
    parseReferenceBytes(process.env.SUPABASE_DATABASE_REFERENCE_BYTES) ??
    getDefaultSupabaseReferenceBytes()
  );
}

function requireR2Config() {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    return null;
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    apiToken: process.env.CLOUDFLARE_R2_API_TOKEN ?? null,
  };
}

function createR2Client(config: NonNullable<ReturnType<typeof requireR2Config>>) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

async function loadSupabaseStorageRow() {
  const config = requireSupabaseConfig();

  if (!config) {
    return createUnavailableStorageRow({
      id: "supabase-database",
      label: "Supabase DB",
      detail: "Database storage",
      statusMessage: "Supabase storage metrics are not configured.",
    });
  }

  try {
    const response = await fetch(
      `https://${config.projectId}.supabase.co/customer/v1/privileged/metrics`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`service_role:${config.secretKey}`).toString("base64")}`,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return createUnavailableStorageRow({
        id: "supabase-database",
        label: "Supabase DB",
        detail: "Database storage",
        statusMessage: "Supabase storage metrics could not be loaded.",
      });
    }

    const metrics = parsePrometheusMetrics(await response.text());
    const usedBytes = selectSupabaseDatabaseUsageBytes(metrics);
    const referenceBytes = getSupabaseReferenceBytes();

    if (usedBytes === null || referenceBytes === null) {
      return createUnavailableStorageRow({
        id: "supabase-database",
        label: "Supabase DB",
        detail: "Database storage",
        statusMessage: "Supabase database size metrics were incomplete.",
      });
    }

    return createReadyStorageRow({
      id: "supabase-database",
      label: "Supabase DB",
      detail: "Database storage",
      usedBytes,
      referenceBytes,
    });
  } catch {
    return createUnavailableStorageRow({
      id: "supabase-database",
      label: "Supabase DB",
      detail: "Database storage",
      statusMessage: "Supabase storage metrics could not be loaded.",
    });
  }
}

async function loadCloudflareStorageFromGraphql(
  config: NonNullable<ReturnType<typeof requireR2Config>>,
) {
  if (!config.apiToken) {
    return null;
  }

  const graphqlQuery = `
    query R2StorageStats($accountTag: string!, $startDate: Time, $endDate: Time, $bucketName: string) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          r2StorageAdaptiveGroups(
            limit: 5
            filter: { datetime_geq: $startDate, datetime_leq: $endDate, bucketName: $bucketName }
            orderBy: [datetime_DESC]
          ) {
            max {
              payloadSize
              metadataSize
            }
          }
        }
      }
    }
  `;

  const endDate = new Date().toISOString();
  const startDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiToken}`,
    },
    cache: "no-store",
    body: JSON.stringify({
      query: graphqlQuery,
      variables: {
        accountTag: config.accountId,
        bucketName: config.bucketName,
        startDate,
        endDate,
      },
    }),
  });

  if (!response.ok) {
    throw new Error("Cloudflare GraphQL request failed.");
  }

  const payload = cloudflareGraphqlResponseSchema.parse(await response.json());

  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message ?? "Cloudflare storage analytics failed.");
  }

  return payload.data?.viewer?.accounts?.[0]?.r2StorageAdaptiveGroups?.[0] ?? null;
}

async function loadCloudflareStorageFromBucketScan(
  config: NonNullable<ReturnType<typeof requireR2Config>>,
) {
  const client = createR2Client(config);
  let totalBytes = 0;
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: config.bucketName,
        ContinuationToken: continuationToken,
      }),
    );

    for (const entry of response.Contents ?? []) {
      totalBytes += entry.Size ?? 0;
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return totalBytes;
}

async function loadCloudflareStorageRow() {
  const config = requireR2Config();
  const referenceBytes = getCloudflareReferenceBytes();

  if (!config) {
    return createUnavailableStorageRow({
      id: "cloudflare-r2",
      label: "Cloudflare R2",
      detail: "Total storage",
      referenceBytes,
      statusMessage: "Cloudflare R2 storage is not configured.",
    });
  }

  try {
    const graphQlSample = await loadCloudflareStorageFromGraphql(config).catch(() => null);
    const usedBytesFromGraphql = deriveCloudflareTotalStorageBytes(graphQlSample);

    if (usedBytesFromGraphql !== null) {
      return createReadyStorageRow({
        id: "cloudflare-r2",
        label: "Cloudflare R2",
        detail: "Total storage",
        usedBytes: usedBytesFromGraphql,
        referenceBytes,
      });
    }

    const usedBytesFromBucketScan = await loadCloudflareStorageFromBucketScan(config);

    return createReadyStorageRow({
      id: "cloudflare-r2",
      label: "Cloudflare R2",
      detail: "Total storage",
      usedBytes: usedBytesFromBucketScan,
      referenceBytes,
    });
  } catch {
    return createUnavailableStorageRow({
      id: "cloudflare-r2",
      label: "Cloudflare R2",
      detail: "Total storage",
      referenceBytes,
      statusMessage: "Cloudflare R2 storage could not be loaded.",
    });
  }
}

export async function getStorageStats() {
  const rows = (await Promise.all([
    loadSupabaseStorageRow(),
    loadCloudflareStorageRow(),
  ])) as StorageMetricRowDto[];

  return {
    rows,
    refreshedAt: new Date().toISOString(),
  } satisfies StorageStatsCardDto;
}
