import type { StorageMetricRowDto } from "@/features/dashboard/server/dto";

type PrometheusMetricSample = {
  name: string;
  labels: Record<string, string>;
  value: number;
};

const DEFAULT_SUPABASE_REFERENCE_BYTES = 500 * 1000 * 1000;
const DEFAULT_CLOUDFLARE_R2_REFERENCE_BYTES = 10 * 1000 * 1000 * 1000;
const prometheusMetricPattern =
  /^(?<name>[a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{(?<labels>[^}]*)\})?\s+(?<value>[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)$/;

export function getDefaultSupabaseReferenceBytes() {
  return DEFAULT_SUPABASE_REFERENCE_BYTES;
}

export function getDefaultCloudflareR2ReferenceBytes() {
  return DEFAULT_CLOUDFLARE_R2_REFERENCE_BYTES;
}

export function parsePrometheusMetrics(input: string) {
  const metrics: PrometheusMetricSample[] = [];

  for (const line of input.split(/\n+/)) {
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(prometheusMetricPattern);

    if (!match?.groups) {
      continue;
    }

    const parsedValue = Number(match.groups.value);

    if (!Number.isFinite(parsedValue)) {
      continue;
    }

    metrics.push({
      name: match.groups.name,
      labels: parsePrometheusLabels(match.groups.labels ?? ""),
      value: parsedValue,
    });
  }

  return metrics;
}

function parsePrometheusLabels(labels: string) {
  const parsedLabels: Record<string, string> = {};

  for (const label of labels.split(",")) {
    if (!label) {
      continue;
    }

    const [rawKey, rawValue] = label.split("=");

    if (!rawKey || !rawValue) {
      continue;
    }

    parsedLabels[rawKey.trim()] = rawValue.trim().replace(/^"/, "").replace(/"$/, "");
  }

  return parsedLabels;
}

export function selectSupabaseDatabaseUsageBytes(
  metrics: ReturnType<typeof parsePrometheusMetrics>,
) {
  const databaseSamples = metrics.filter((metric) => metric.name === "pg_database_size_bytes");
  const postgresSample = databaseSamples.find((metric) => metric.labels.datname === "postgres");

  if (postgresSample) {
    return postgresSample.value;
  }

  return databaseSamples.toSorted((left, right) => right.value - left.value)[0]?.value ?? null;
}

export function parseReferenceBytes(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return Math.round(parsedValue);
}

export function deriveCloudflareTotalStorageBytes(
  sample:
    | {
        max?: {
          payloadSize?: number | null;
          metadataSize?: number | null;
        } | null;
      }
    | null
    | undefined,
) {
  const payloadSize = sample?.max?.payloadSize ?? null;
  const metadataSize = sample?.max?.metadataSize ?? null;

  if (payloadSize === null && metadataSize === null) {
    return null;
  }

  return Math.max(0, (payloadSize ?? 0) + (metadataSize ?? 0));
}

export function calculatePercentUsed(usedBytes: number, referenceBytes: number) {
  if (referenceBytes <= 0) {
    return null;
  }

  return Math.min(100, Math.round((usedBytes / referenceBytes) * 100));
}

export function createReadyStorageRow(
  input: Pick<StorageMetricRowDto, "id" | "label" | "detail"> & {
    usedBytes: number;
    referenceBytes: number;
  },
): StorageMetricRowDto {
  return {
    id: input.id,
    label: input.label,
    detail: input.detail,
    usedBytes: input.usedBytes,
    referenceBytes: input.referenceBytes,
    percentUsed: calculatePercentUsed(input.usedBytes, input.referenceBytes),
    fetchStatus: "ready",
    statusMessage: null,
  };
}

export function createUnavailableStorageRow(
  input: Pick<StorageMetricRowDto, "id" | "label" | "detail"> & {
    referenceBytes?: number | null;
    statusMessage: string;
  },
): StorageMetricRowDto {
  return {
    id: input.id,
    label: input.label,
    detail: input.detail,
    usedBytes: null,
    referenceBytes: input.referenceBytes ?? null,
    percentUsed: null,
    fetchStatus: "unavailable",
    statusMessage: input.statusMessage,
  };
}
