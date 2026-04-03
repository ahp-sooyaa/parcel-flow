import "server-only";
import { asc, desc, eq, ilike, or } from "drizzle-orm";
import {
  toRiderDetailDto,
  toRiderListItemDto,
  type RiderDetailDto,
  type RiderListItemDto,
} from "./dto";
import { isRiderId, normalizeRiderSearchQuery, toRiderSearchPattern } from "./utils";
import { db } from "@/db";
import { appUsers, riders, townships } from "@/db/schema";

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
      id: riders.appUserId,
      fullName: appUsers.fullName,
      phoneNumber: appUsers.phoneNumber,
      townshipName: townships.name,
      vehicleType: riders.vehicleType,
      licensePlate: riders.licensePlate,
      isActive: riders.isActive,
      notes: riders.notes,
      createdAt: riders.createdAt,
    })
    .from(riders)
    .innerJoin(appUsers, eq(riders.appUserId, appUsers.id))
    .leftJoin(townships, eq(riders.townshipId, townships.id))
    .where(
      searchPattern
        ? or(
            ilike(appUsers.fullName, searchPattern),
            ilike(appUsers.phoneNumber, searchPattern),
            ilike(riders.vehicleType, searchPattern),
            ilike(riders.licensePlate, searchPattern),
          )
        : undefined,
    )
    .orderBy(asc(appUsers.fullName), desc(riders.createdAt))
    .limit(safeLimit);

  return rows.map((row) =>
    toRiderListItemDto({
      id: row.id,
      fullName: row.fullName,
      phoneNumber: row.phoneNumber,
      townshipName: row.townshipName,
      vehicleType: row.vehicleType,
      licensePlate: row.licensePlate,
      isActive: row.isActive,
      notes: row.notes,
      createdAt: row.createdAt,
    }),
  );
}

export async function createRiderProfile(input: {
  appUserId: string;
  townshipId: string | null;
  vehicleType: string;
  licensePlate: string | null;
  isActive: boolean;
  notes: string | null;
}) {
  const [created] = await db
    .insert(riders)
    .values({
      appUserId: input.appUserId,
      townshipId: input.townshipId,
      vehicleType: input.vehicleType,
      licensePlate: input.licensePlate,
      isActive: input.isActive,
      notes: input.notes,
    })
    .returning({ id: riders.appUserId });

  return created;
}

export async function getRiderById(riderId: string): Promise<RiderDetailDto | null> {
  if (!isRiderId(riderId)) {
    return null;
  }

  const [row] = await db
    .select({
      id: riders.appUserId,
      fullName: appUsers.fullName,
      email: appUsers.email,
      phoneNumber: appUsers.phoneNumber,
      townshipName: townships.name,
      vehicleType: riders.vehicleType,
      licensePlate: riders.licensePlate,
      isActive: riders.isActive,
      notes: riders.notes,
      createdAt: riders.createdAt,
      updatedAt: riders.updatedAt,
    })
    .from(riders)
    .innerJoin(appUsers, eq(riders.appUserId, appUsers.id))
    .leftJoin(townships, eq(riders.townshipId, townships.id))
    .where(eq(riders.appUserId, riderId))
    .limit(1);

  if (!row) {
    return null;
  }

  return toRiderDetailDto({
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phoneNumber: row.phoneNumber,
    townshipName: row.townshipName,
    vehicleType: row.vehicleType,
    licensePlate: row.licensePlate,
    isActive: row.isActive,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export async function findRiderByAppUserId(appUserId: string) {
  const [row] = await db
    .select({ id: riders.appUserId })
    .from(riders)
    .where(eq(riders.appUserId, appUserId))
    .limit(1);

  return row ?? null;
}
