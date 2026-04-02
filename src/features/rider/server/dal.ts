import "server-only";
import { and, asc, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { toRiderListItemDto, type RiderLinkableUserDto, type RiderListItemDto } from "./dto";
import { normalizeRiderSearchQuery, toRiderSearchPattern } from "./utils";
import { db } from "@/db";
import { appUsers, riders, roles } from "@/db/schema";

export async function getRidersList(
  input: {
    query?: string;
    limit?: number;
  } = {},
): Promise<RiderListItemDto[]> {
  const normalizedQuery = normalizeRiderSearchQuery(input.query);
  const safeLimit = Number.isInteger(input.limit)
    ? Math.min(Math.max(input.limit ?? 50, 1), 200)
    : 50;
  const searchPattern = normalizedQuery ? toRiderSearchPattern(normalizedQuery) : null;

  const rows = await db
    .select({
      id: riders.id,
      riderCode: riders.riderCode,
      fullName: riders.fullName,
      phoneNumber: riders.phoneNumber,
      township: riders.township,
      address: riders.address,
      linkedAppUserId: riders.linkedAppUserId,
      linkedAppUserName: appUsers.fullName,
      createdAt: riders.createdAt,
    })
    .from(riders)
    .leftJoin(appUsers, eq(riders.linkedAppUserId, appUsers.id))
    .where(
      searchPattern
        ? or(
            ilike(riders.riderCode, searchPattern),
            ilike(riders.fullName, searchPattern),
            ilike(riders.phoneNumber, searchPattern),
          )
        : undefined,
    )
    .orderBy(asc(riders.fullName), desc(riders.createdAt))
    .limit(safeLimit);

  return rows.map((row) =>
    toRiderListItemDto({
      id: row.id,
      riderCode: row.riderCode,
      fullName: row.fullName,
      phoneNumber: row.phoneNumber,
      township: row.township,
      address: row.address,
      linkedAppUserId: row.linkedAppUserId,
      linkedAppUserName: row.linkedAppUserName,
      createdAt: row.createdAt,
    }),
  );
}

export async function createRider(input: {
  riderCode: string;
  fullName: string;
  phoneNumber: string | null;
  address: string;
  township: string;
  notes: string | null;
  linkedAppUserId: string | null;
}) {
  const [created] = await db
    .insert(riders)
    .values({
      riderCode: input.riderCode,
      fullName: input.fullName,
      phoneNumber: input.phoneNumber,
      address: input.address,
      township: input.township,
      notes: input.notes,
      linkedAppUserId: input.linkedAppUserId,
    })
    .returning({ id: riders.id });

  return created;
}

export async function findRiderByLinkedAppUserId(linkedAppUserId: string) {
  const [row] = await db
    .select({ id: riders.id })
    .from(riders)
    .where(eq(riders.linkedAppUserId, linkedAppUserId))
    .limit(1);

  return row ?? null;
}

export async function findActiveRiderAppUserById(appUserId: string) {
  const [row] = await db
    .select({
      id: appUsers.id,
      fullName: appUsers.fullName,
      email: appUsers.email,
    })
    .from(appUsers)
    .innerJoin(roles, eq(appUsers.roleId, roles.id))
    .where(and(eq(appUsers.id, appUserId), eq(appUsers.isActive, true), eq(roles.slug, "rider")))
    .limit(1);

  return row ?? null;
}

export async function getRiderLinkableUsers(): Promise<RiderLinkableUserDto[]> {
  return db
    .select({
      id: appUsers.id,
      fullName: appUsers.fullName,
      email: appUsers.email,
    })
    .from(appUsers)
    .innerJoin(roles, eq(appUsers.roleId, roles.id))
    .leftJoin(riders, eq(riders.linkedAppUserId, appUsers.id))
    .where(and(eq(roles.slug, "rider"), eq(appUsers.isActive, true), isNull(riders.id)))
    .orderBy(asc(appUsers.fullName));
}
