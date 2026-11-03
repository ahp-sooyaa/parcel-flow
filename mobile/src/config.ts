/**
 * Returns the configured API base URL without a trailing slash, or null when it
 * is missing or not an allowed URL. The app shows a configuration error instead
 * of guessing an address.
 *
 * Plain `http://` is allowed only in development (a LAN address for Expo Go):
 * Android blocks cleartext traffic in release builds, so every request would fail.
 */
export function readApiUrl(
  value: string | undefined,
  { allowHttp }: { allowHttp: boolean },
): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);

    if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) {
      return null;
    }
  } catch {
    return null;
  }

  return trimmed.replace(/\/+$/, "");
}

// Expo inlines EXPO_PUBLIC_* variables at build time, so this must be a literal
// `process.env.EXPO_PUBLIC_API_URL` access.
export const apiUrl = readApiUrl(process.env.EXPO_PUBLIC_API_URL, { allowHttp: __DEV__ });
