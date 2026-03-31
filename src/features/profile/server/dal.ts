import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { toProfilePageDto, type ProfilePageDto } from "./dto";
import { db } from "@/db";
import { appUsers } from "@/db/schema";

type E2EAuthHeader = {
  authenticated?: boolean;
};

async function getStubbedProfileForE2E(): Promise<ProfilePageDto | null> {
  if (process.env.AUTH_E2E_STUB_MODE !== "1") {
    return null;
  }

  const requestHeaders = await headers();
  const raw = requestHeaders.get("x-parcel-flow-e2e-auth");

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as E2EAuthHeader;

    if (parsed.authenticated !== true) {
      return null;
    }

    return toProfilePageDto({
      fullName: "E2E Test User",
      email: "e2e-user@example.com",
      phoneNumber: null,
    });
  } catch {
    return null;
  }
}

export async function getProfileByAppUserId(appUserId: string): Promise<ProfilePageDto | null> {
  const stubbed = await getStubbedProfileForE2E();

  if (stubbed) {
    return stubbed;
  }

  const [row] = await db
    .select({
      fullName: appUsers.fullName,
      email: appUsers.email,
      phoneNumber: appUsers.phoneNumber,
    })
    .from(appUsers)
    .where(eq(appUsers.id, appUserId))
    .limit(1);

  return row ? toProfilePageDto(row) : null;
}
