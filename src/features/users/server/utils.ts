const internalEmailDomain = "users.parcel-flow.local";

export function normalizePhoneNumber(phoneNumber: string) {
  return phoneNumber.trim().replaceAll(" ", "");
}

export function buildUsernameBase(name: string) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.length >= 3 ? normalized : `user-${normalized || "account"}`;
}

export function buildInternalEmail(username: string) {
  return `${username}@${internalEmailDomain}`;
}
