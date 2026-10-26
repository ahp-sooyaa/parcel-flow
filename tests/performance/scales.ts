export type PerfScale = "small" | "medium" | "large";

const scaleCounts: Record<PerfScale, number> = {
  small: 100,
  medium: 1_000,
  large: 10_000,
};

export function parsePerfScale(value = process.env.PERF_SCALE ?? "small"): PerfScale {
  if (value === "medium" || value === "large") {
    return value;
  }

  return "small";
}

export function getParcelCountForScale(scale: PerfScale) {
  return scaleCounts[scale];
}

export { createSeededRandom } from "@/lib/random";
