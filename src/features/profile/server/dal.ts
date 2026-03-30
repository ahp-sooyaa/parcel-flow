import "server-only";
import { eq } from "drizzle-orm";
import { toProfilePageDto, type ProfilePageDto } from "./dto";
import { db } from "@/db";
import { appUsers } from "@/db/schema";

export async function getProfileByAppUserId(appUserId: string): Promise<ProfilePageDto | null> {
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
