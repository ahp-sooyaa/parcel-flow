/**
 * Returns the configured API base URL without a trailing slash, or null when it
 * is missing or not an http(s) URL. The app shows a configuration error instead
 * of guessing an address.
 */
export function readApiUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
  } catch {
    return null;
  }

  return trimmed.replace(/\/+$/, "");
}

// Expo inlines EXPO_PUBLIC_* variables at build time, so this must be a literal
// `process.env.EXPO_PUBLIC_API_URL` access.
export const apiUrl = readApiUrl(process.env.EXPO_PUBLIC_API_URL);
