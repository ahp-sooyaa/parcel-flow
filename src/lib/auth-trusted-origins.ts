// Production builds of the mobile app send this scheme as their origin.
export const MOBILE_APP_ORIGIN = "parcelflow://";

/**
 * Origins Better Auth trusts besides its own base URL: the mobile app scheme,
 * plus any extra origins (Expo Go, development builds) listed in
 * `MOBILE_TRUSTED_ORIGINS` as a comma-separated value.
 */
export function getMobileTrustedOrigins(extraOrigins = process.env.MOBILE_TRUSTED_ORIGINS) {
  const configuredOrigins = (extraOrigins ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [...new Set([MOBILE_APP_ORIGIN, ...configuredOrigins])];
}
