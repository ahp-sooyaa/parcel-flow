type Bucket = {
  tokens: number;
  updatedAt: number;
};

export type RateLimiter = {
  /** Takes one token for `key`. Returns false when the caller is over the limit. */
  take: (key: string, now?: number) => boolean;
};

/**
 * In-memory token bucket. The app runs as a single Railway replica, so a
 * process-local map is enough to slow down scripted abuse of the demo.
 */
export function createRateLimiter(options: {
  /** Burst size. */
  capacity: number;
  /** Tokens added back per minute. */
  refillPerMinute: number;
  /** Upper bound on tracked keys, so the map cannot grow without limit. */
  maxKeys?: number;
}): RateLimiter {
  const buckets = new Map<string, Bucket>();
  const maxKeys = options.maxKeys ?? 10_000;
  const refillPerMs = options.refillPerMinute / 60_000;

  return {
    take(key, now = Date.now()) {
      const bucket = buckets.get(key);
      const tokens = bucket
        ? Math.min(options.capacity, bucket.tokens + (now - bucket.updatedAt) * refillPerMs)
        : options.capacity;

      if (tokens < 1) {
        buckets.set(key, { tokens, updatedAt: now });
        return false;
      }

      if (!bucket && buckets.size >= maxKeys) {
        // Drop the oldest entry; Map keeps insertion order.
        const oldestKey = buckets.keys().next().value;
        if (oldestKey !== undefined) {
          buckets.delete(oldestKey);
        }
      }

      buckets.delete(key);
      buckets.set(key, { tokens: tokens - 1, updatedAt: now });
      return true;
    },
  };
}

export function getClientIp(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return headers.get("x-real-ip")?.trim() || "unknown";
}
