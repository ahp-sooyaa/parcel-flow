import { and, asc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import {
  appUsers,
  bankAccounts,
  merchants,
  riders,
  riderServiceTownships,
  townships,
} from "@/db/schema";
import type {
  BankAccountDto,
  UserListFiltersDto,
  UserListItemDto,
  UserListPageDto,
} from "@/features/users/server/dto";
import { buildUsernameBase, normalizePhoneNumber } from "@/features/users/server/utils";
import type { UserRole } from "@/lib/domain";
import { userRoles } from "@/lib/domain";
import { CACHE_TAGS, userBanksTag, userProfileTag } from "@/lib/cache-tags";

const userRoleSchema = z.enum(userRoles);

function mapBankAccount(row: typeof bankAccounts.$inferSelect): BankAccountDto {
  return {
    id: row.id,
    userId: row.userId,
    bankName: row.bankName,
    accountHolderName: row.accountHolderName,
    accountNumber: row.accountNumber,
    isCompanyAccount: row.isCompanyAccount,
    isPrimary: row.isPrimary,
  };
}

type UserListRow = Pick<
  typeof appUsers.$inferSelect,
  "id" | "name" | "phoneNumber" | "address" | "age" | "role" | "isActive" | "mustResetPassword"
>;

type UserProfileRows = {
  merchantByUserId: Map<string, typeof merchants.$inferSelect>;
  riderByUserId: Map<string, typeof riders.$inferSelect>;
  serviceTownshipByRiderId: Map<string, { id: string; name: string }>;
};

async function loadUserProfileRows(userIds: string[]): Promise<UserProfileRows> {
  if (userIds.length === 0) {
    return {
      merchantByUserId: new Map(),
      riderByUserId: new Map(),
      serviceTownshipByRiderId: new Map(),
    };
  }

  const [merchantRows, riderRows] = await Promise.all([
    db.select().from(merchants).where(inArray(merchants.userId, userIds)),
    db.select().from(riders).where(inArray(riders.userId, userIds)),
  ]);

  const riderIds = riderRows.map((rider) => rider.id);
  const serviceTownshipRows =
    riderIds.length > 0
      ? await db
          .select({
            riderId: riderServiceTownships.riderId,
            townshipId: townships.id,
            townshipName: townships.name,
          })
          .from(riderServiceTownships)
          .innerJoin(townships, eq(townships.id, riderServiceTownships.townshipId))
          .where(inArray(riderServiceTownships.riderId, riderIds))
      : [];

  return {
    merchantByUserId: new Map(merchantRows.map((merchant) => [merchant.userId ?? "", merchant])),
    riderByUserId: new Map(riderRows.map((rider) => [rider.userId ?? "", rider])),
    serviceTownshipByRiderId: new Map(
      serviceTownshipRows.map((row) => [
        row.riderId,
        {
          id: row.townshipId,
          name: row.townshipName,
        },
      ]),
    ),
  };
}

function mapUser(row: UserListRow, profileRows: UserProfileRows): UserListItemDto {
  const merchant = profileRows.merchantByUserId.get(row.id);
  const rider = profileRows.riderByUserId.get(row.id);
  const serviceTownship = rider
    ? (profileRows.serviceTownshipByRiderId.get(rider.id) ?? null)
    : null;

  return {
    id: row.id,
    name: row.name,
    phoneNumber: row.phoneNumber,
    address: row.address,
    age: row.age,
    role: userRoleSchema.parse(row.role),
    shopName: merchant?.shopName ?? null,
    serviceTownshipId: serviceTownship?.id ?? null,
    serviceTownshipName: serviceTownship?.name ?? null,
    isActive: row.isActive,
    mustResetPassword: row.mustResetPassword,
  };
}

export async function listUsersPage(filters: UserListFiltersDto): Promise<UserListPageDto> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.users);

  const where = buildUserListWhere(filters);

  const totalCountRow = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(appUsers)
    .where(where)
    .then((rows) => rows[0]);

  const totalCount = totalCountRow?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const offset = (page - 1) * filters.pageSize;

  const rows = await db
    .select({
      id: appUsers.id,
      name: appUsers.name,
      phoneNumber: appUsers.phoneNumber,
      address: appUsers.address,
      age: appUsers.age,
      role: appUsers.role,
      isActive: appUsers.isActive,
      mustResetPassword: appUsers.mustResetPassword,
    })
    .from(appUsers)
    .where(where)
    .orderBy(asc(appUsers.name), asc(appUsers.id))
    .limit(filters.pageSize)
    .offset(offset);

  const profileRows = await loadUserProfileRows(rows.map((user) => user.id));

  return {
    users: rows.map((user) => mapUser(user, profileRows)),
    page,
    pageSize: filters.pageSize,
    totalCount,
    totalPages,
  };
}

export async function listUsers() {
  const page = await listUsersPage({ searchTerm: "", page: 1, pageSize: 10_000 });
  return page.users;
}

function buildUserListWhere(filters: Pick<UserListFiltersDto, "searchTerm">) {
  const normalizedSearchTerm = filters.searchTerm.trim();

  return and(
    isNull(appUsers.deletedAt),
    normalizedSearchTerm
      ? or(
          ilike(appUsers.name, `%${normalizedSearchTerm}%`),
          ilike(appUsers.phoneNumber, `%${normalizedSearchTerm}%`),
        )
      : undefined,
  );
}

export async function getUserById(id: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(userProfileTag(id), CACHE_TAGS.users);

  const [row] = await db
    .select()
    .from(appUsers)
    .where(and(eq(appUsers.id, id), isNull(appUsers.deletedAt)))
    .limit(1);

  if (!row) {
    return null;
  }

  const profileRows = await loadUserProfileRows([row.id]);

  return mapUser(row, profileRows);
}

export async function listBankAccountsForUser(userId: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(userBanksTag(userId));

  const rows = await db
    .select()
    .from(bankAccounts)
    .where(and(eq(bankAccounts.userId, userId), isNull(bankAccounts.deletedAt)));

  return rows.map(mapBankAccount);
}

export async function listBankAccountsForUserIds(
  userIds: string[],
): Promise<Record<string, BankAccountDto[]>> {
  "use cache";
  cacheLife("minutes");

  // Stable key so the same page of users hits one cache entry.
  const uniqueUserIds = Array.from(new Set(userIds)).toSorted((left, right) =>
    left.localeCompare(right),
  );
  cacheTag(CACHE_TAGS.users, ...uniqueUserIds.map(userBanksTag));

  if (uniqueUserIds.length === 0) {
    return {};
  }

  const rows = await db
    .select()
    .from(bankAccounts)
    .where(and(inArray(bankAccounts.userId, uniqueUserIds), isNull(bankAccounts.deletedAt)));

  const accountsByUserId: Record<string, BankAccountDto[]> = {};

  for (const row of rows) {
    const accounts = accountsByUserId[row.userId] ?? [];
    accounts.push(mapBankAccount(row));
    accountsByUserId[row.userId] = accounts;
  }

  return accountsByUserId;
}

export async function findUniqueUsername(name: string) {
  const baseUsername = buildUsernameBase(name);

  for (let suffix = 0; suffix < 100; suffix += 1) {
    const username = suffix === 0 ? baseUsername : `${baseUsername}-${suffix + 1}`;
    const [existingUser] = await db
      .select({ id: appUsers.id })
      .from(appUsers)
      .where(eq(appUsers.username, username))
      .limit(1);

    if (!existingUser) {
      return username;
    }
  }

  throw new Error("Unable to generate a unique username.");
}

export async function createRoleProfile(input: {
  userId: string;
  role: UserRole;
  shopName?: string;
  address: string;
  serviceTownshipId?: string;
}) {
  if (input.role === "merchant") {
    await db.insert(merchants).values({
      userId: input.userId,
      shopName: input.shopName ?? "",
      address: input.address,
    });
  }

  if (input.role === "rider") {
    const [rider] = await db.insert(riders).values({ userId: input.userId }).returning();

    if (input.serviceTownshipId) {
      await db.insert(riderServiceTownships).values({
        riderId: rider.id,
        townshipId: input.serviceTownshipId,
      });
    }
  }
}

export async function updateUserProfile(input: {
  id: string;
  name: string;
  phoneNumber: string;
  address: string;
  age?: number;
  role: UserRole;
  isActive: boolean;
  shopName?: string;
  serviceTownshipId?: string;
}) {
  await db
    .update(appUsers)
    .set({
      name: input.name,
      phoneNumber: normalizePhoneNumber(input.phoneNumber),
      address: input.address,
      age: input.age ?? null,
      role: input.role,
      isActive: input.isActive,
      updatedAt: new Date(),
    })
    .where(eq(appUsers.id, input.id));

  const [existingMerchant] = await db
    .select()
    .from(merchants)
    .where(eq(merchants.userId, input.id))
    .limit(1);
  const [existingRider] = await db
    .select()
    .from(riders)
    .where(eq(riders.userId, input.id))
    .limit(1);

  if (input.role === "merchant") {
    if (existingMerchant) {
      await db
        .update(merchants)
        .set({
          shopName: input.shopName ?? "",
          address: input.address,
          updatedAt: new Date(),
        })
        .where(eq(merchants.id, existingMerchant.id));
    } else {
      await db.insert(merchants).values({
        userId: input.id,
        shopName: input.shopName ?? "",
        address: input.address,
      });
    }
  }

  if (input.role === "rider") {
    const rider =
      existingRider ?? (await db.insert(riders).values({ userId: input.id }).returning())[0];

    await db.delete(riderServiceTownships).where(eq(riderServiceTownships.riderId, rider.id));

    if (input.serviceTownshipId) {
      await db.insert(riderServiceTownships).values({
        riderId: rider.id,
        townshipId: input.serviceTownshipId,
      });
    }
  }

  return getUserById(input.id);
}

export async function createBankAccountForUser(
  input: typeof bankAccounts.$inferInsert,
): Promise<BankAccountDto> {
  const [row] = await db.transaction(async (tx) => {
    if (input.isPrimary) {
      await tx
        .update(bankAccounts)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(and(eq(bankAccounts.userId, input.userId), isNull(bankAccounts.deletedAt)));
    }

    return tx.insert(bankAccounts).values(input).returning();
  });

  return mapBankAccount(row);
}

export async function updateBankAccountForUser(
  input: typeof bankAccounts.$inferInsert & { id: string },
): Promise<BankAccountDto | null> {
  const [row] = await db.transaction(async (tx) => {
    if (input.isPrimary) {
      await tx
        .update(bankAccounts)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(and(eq(bankAccounts.userId, input.userId), isNull(bankAccounts.deletedAt)));
    }

    return tx
      .update(bankAccounts)
      .set({
        bankName: input.bankName,
        accountHolderName: input.accountHolderName,
        accountNumber: input.accountNumber,
        isCompanyAccount: input.isCompanyAccount,
        isPrimary: input.isPrimary,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bankAccounts.id, input.id),
          eq(bankAccounts.userId, input.userId),
          isNull(bankAccounts.deletedAt),
        ),
      )
      .returning();
  });

  return row ? mapBankAccount(row) : null;
}
