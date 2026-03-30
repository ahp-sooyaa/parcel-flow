import "server-only";
import { randomBytes } from "node:crypto";

export function generateStrongPassword(length = 24): string {
  const raw = randomBytes(Math.ceil(length * 0.8)).toString("base64url");
  const base = raw.slice(0, length);

  const withGuarantees = `${base}A!9`;

  return withGuarantees.slice(0, Math.max(length, 12));
}
