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

export function createSeededRandom(seed: string) {
  let state = hashSeed(seed);

  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function hashSeed(seed: string) {
  let hash = 2_166_136_261;

  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}
