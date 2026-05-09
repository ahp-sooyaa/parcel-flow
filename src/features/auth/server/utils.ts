import { randomBytes } from "node:crypto";

export function generateTemporaryPassword() {
  return `PF-${randomBytes(6).toString("base64url")}`;
}
