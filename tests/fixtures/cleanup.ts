import { inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "@/db/schema";
import {
  appUsers,
  bankAccounts,
  financialItems,
  merchants,
  merchantSettlements,
  parcels,
  parcelCorrectionLogs,
  parcelStatusLogs,
  riders,
  riderServiceTownships,
  sessions,
  townships,
} from "@/db/schema";

type TestRecordIds = {
  userIds?: string[];
  merchantIds?: string[];
  riderIds?: string[];
  townshipIds?: string[];
  parcelIds?: string[];
  bankAccountIds?: string[];
  settlementIds?: string[];
};

export async function cleanupTestRecords(
  db: PostgresJsDatabase<typeof schema>,
  ids: TestRecordIds,
) {
  if (ids.parcelIds?.length) {
    await db.delete(financialItems).where(inArray(financialItems.parcelId, ids.parcelIds));
    await db
      .delete(parcelCorrectionLogs)
      .where(inArray(parcelCorrectionLogs.parcelId, ids.parcelIds));
    await db.delete(parcelStatusLogs).where(inArray(parcelStatusLogs.parcelId, ids.parcelIds));
    await db.delete(parcels).where(inArray(parcels.id, ids.parcelIds));
  }

  if (ids.settlementIds?.length) {
    await db.delete(merchantSettlements).where(inArray(merchantSettlements.id, ids.settlementIds));
  }

  if (ids.bankAccountIds?.length) {
    await db.delete(bankAccounts).where(inArray(bankAccounts.id, ids.bankAccountIds));
  }

  if (ids.riderIds?.length) {
    await db
      .delete(riderServiceTownships)
      .where(inArray(riderServiceTownships.riderId, ids.riderIds));
    await db.delete(riders).where(inArray(riders.id, ids.riderIds));
  }

  if (ids.merchantIds?.length) {
    await db.delete(merchants).where(inArray(merchants.id, ids.merchantIds));
  }

  if (ids.townshipIds?.length) {
    await db.delete(townships).where(inArray(townships.id, ids.townshipIds));
  }

  if (ids.userIds?.length) {
    await db.delete(sessions).where(inArray(sessions.userId, ids.userIds));
    await db.delete(appUsers).where(inArray(appUsers.id, ids.userIds));
  }
}
