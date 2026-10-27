import { z } from "zod";

import type { ParcelFailureNoteEntry } from "@/features/parcels/server/failure-notes";
import { isParcelStatus, parcelStatuses, type ParcelStatus, type ParcelType } from "@/lib/domain";
import { maxLengthMessage, TEXT_LIMITS } from "@/lib/validation";

function isNonNegativeIntegerString(value: string) {
  const numberValue = Number(value);

  return value.trim().length > 0 && Number.isInteger(numberValue) && numberValue >= 0;
}

function isOptionalPositiveNumberString(value: string) {
  if (value.trim().length === 0) {
    return true;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) && numberValue > 0;
}

const optionalPositiveNumberString = z
  .string()
  .trim()
  .refine(isOptionalPositiveNumberString, "Enter a number greater than 0.");

const parcelDimensionsInputSchema = z.object({
  estimatedWeight: optionalPositiveNumberString,
  width: optionalPositiveNumberString,
  height: optionalPositiveNumberString,
  length: optionalPositiveNumberString,
});

const baseParcelFormInputSchema = z.object({
  merchantId: z.string().min(1, "Merchant is required.").max(TEXT_LIMITS.id),
  receiverName: z
    .string()
    .trim()
    .min(1, "Receiver name is required.")
    .max(TEXT_LIMITS.name, maxLengthMessage("Receiver name", TEXT_LIMITS.name)),
  receiverPhoneNumber: z
    .string()
    .trim()
    .min(5, "Receiver phone number is required.")
    .max(
      TEXT_LIMITS.phoneNumber,
      maxLengthMessage("Receiver phone number", TEXT_LIMITS.phoneNumber),
    ),
  receiverAddress: z
    .string()
    .trim()
    .min(1, "Receiver address is required.")
    .max(TEXT_LIMITS.address, maxLengthMessage("Receiver address", TEXT_LIMITS.address)),
  specialNotes: z
    .string()
    .trim()
    .max(TEXT_LIMITS.note, maxLengthMessage("Special notes", TEXT_LIMITS.note))
    .optional(),
  townshipId: z.string().min(1, "Receiver township is required.").max(TEXT_LIMITS.id),
  deliveryFee: z
    .string()
    .trim()
    .refine(isNonNegativeIntegerString, "Delivery fee must be 0 or greater."),
  hasCod: z.boolean(),
  codAmount: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || isNonNegativeIntegerString(value),
      "COD amount must be 0 or greater.",
    ),
  dimensions: parcelDimensionsInputSchema,
});

function refineParcelFormInput(
  value: z.infer<typeof baseParcelFormInputSchema>,
  ctx: z.RefinementCtx,
) {
  if (!value.hasCod) {
    return;
  }

  if (!isNonNegativeIntegerString(value.codAmount) || Number(value.codAmount) <= 0) {
    ctx.addIssue({
      code: "custom",
      message: "COD amount is required for COD parcels.",
      path: ["codAmount"],
    });
  }
}

export const createParcelFormInputSchema =
  baseParcelFormInputSchema.superRefine(refineParcelFormInput);

export type CreateParcelFormInputDto = z.infer<typeof createParcelFormInputSchema>;

export const updateParcelFormInputSchema = baseParcelFormInputSchema
  .extend({
    id: z.uuid("Invalid parcel selection."),
  })
  .superRefine(refineParcelFormInput);

export type UpdateParcelFormInputDto = z.infer<typeof updateParcelFormInputSchema>;

export type CreateParcelInputDto = {
  merchantId: string;
  receiverName: string;
  receiverPhoneNumber: string;
  receiverAddress: string;
  specialNotes?: string;
  townshipId: string;
  parcelType: ParcelType;
  codAmount: number;
  deliveryFee: number;
  weightKg: number;
  isLargeParcel: boolean;
  parcelWidthCm?: number;
  parcelHeightCm?: number;
  parcelLengthCm?: number;
};

export type UpdateParcelInputDto = CreateParcelInputDto & {
  id: string;
};

const correctionRiderIdSchema = z.preprocess(
  (value) => (value === "" ? null : value),
  z.uuid("Invalid rider selection.").nullable(),
);

const optionalCorrectionRiderIdSchema = z.preprocess(
  (value) => (value === "" ? null : value),
  z.uuid("Invalid rider selection.").nullable().optional(),
);

const correctionReasonSchema = z
  .string()
  .trim()
  .min(1, "Correction reason is required.")
  .max(TEXT_LIMITS.note, maxLengthMessage("Correction reason", TEXT_LIMITS.note));

export const correctParcelStatusInputSchema = z.object({
  parcelId: z.uuid("Invalid parcel selection."),
  expectedStatus: z.enum(parcelStatuses),
  expectedRiderId: correctionRiderIdSchema,
  expectedFinancialItemsFingerprint: z.string().trim().min(1, "Parcel state is stale."),
  targetStatus: z.enum(parcelStatuses),
  targetRiderId: optionalCorrectionRiderIdSchema,
  proofImageKey: z
    .string()
    .trim()
    .transform((value) => (value && value.length > 0 ? value : undefined))
    .optional(),
  reason: correctionReasonSchema,
});

export type CorrectParcelStatusInputDto = z.infer<typeof correctParcelStatusInputSchema>;

export const correctParcelRiderInputSchema = z.object({
  parcelId: z.uuid("Invalid parcel selection."),
  expectedStatus: z.enum(parcelStatuses),
  expectedRiderId: correctionRiderIdSchema,
  expectedFinancialItemsFingerprint: z.string().trim().min(1, "Parcel state is stale."),
  targetRiderId: z.preprocess(
    (value) => (value === "" ? null : value),
    z.uuid("Invalid rider selection.").nullable(),
  ),
  reason: correctionReasonSchema,
});

export type CorrectParcelRiderInputDto = z.infer<typeof correctParcelRiderInputSchema>;

export type ParcelCorrectionType = "status" | "rider";

export type ParcelCorrectionSideEffectsDto = {
  summary: string[];
};

export type ParcelCorrectionLogDto = {
  id: string;
  correctionType: ParcelCorrectionType;
  oldStatus: ParcelStatus | null;
  newStatus: ParcelStatus | null;
  oldRiderId: string | null;
  oldRiderName: string | null;
  newRiderId: string | null;
  newRiderName: string | null;
  reason: string;
  sideEffects: ParcelCorrectionSideEffectsDto;
  createdByName: string | null;
  createdAt: string;
};

export type ParcelListItemDto = {
  id: string;
  parcelCode: string;
  merchantId: string;
  merchantName: string;
  riderId: string | null;
  receiverName: string;
  receiverPhoneNumber: string;
  receiverAddress: string;
  specialNotes: string | null;
  failureNotes: ParcelFailureNoteEntry[];
  activeFailureNote: ParcelFailureNoteEntry | null;
  townshipId: string;
  townshipName: string;
  parcelType: ParcelType;
  codAmount: number;
  deliveryFee: number;
  weightKg: number;
  parcelWidthCm: number | null;
  parcelHeightCm: number | null;
  parcelLengthCm: number | null;
  proofOfDeliveryImagesKeys: string[];
  riderName: string | null;
  status: ParcelStatus;
  hasUnresolvedFailureReview: boolean;
  correctionStateToken: string;
  correctionLogs: ParcelCorrectionLogDto[];
  createdAt: string;
};

export type ParcelSummaryDto = {
  totalParcels: number;
  atOffice: number;
  onTheWay: number;
  delivered: number;
  expectedCollection: number;
};

export const merchantParcelStatusFilters = ["all", "on_the_way", "delivered"] as const;
export type MerchantParcelStatusFilter = (typeof merchantParcelStatusFilters)[number];

const merchantParcelSearchParamsSchema = z.object({
  query: z.string().trim().max(100).optional().catch(""),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date filter must use YYYY-MM-DD format.")
    .optional()
    .catch(undefined),
  status: z.enum(merchantParcelStatusFilters).optional().catch("all"),
  page: z.coerce.number().int().min(1).optional().catch(1),
});

export type MerchantParcelListFiltersDto = {
  searchTerm: string;
  createdOn: string | null;
  status: MerchantParcelStatusFilter;
  page: number;
  pageSize: number;
};

export type MerchantParcelListPageDto = {
  parcels: ParcelListItemDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasAnyParcels: boolean;
};

export const merchantParcelPageSize = 10;

export function parseMerchantParcelListFilters(
  input: Record<string, string | string[] | undefined>,
) {
  const parseResult = merchantParcelSearchParamsSchema.safeParse({
    query: readSearchParam(input.query),
    date: readSearchParam(input.date),
    status: readSearchParam(input.status),
    page: readSearchParam(input.page),
  });

  if (!parseResult.success) {
    return {
      searchTerm: "",
      createdOn: null,
      status: "all",
      page: 1,
      pageSize: merchantParcelPageSize,
    } satisfies MerchantParcelListFiltersDto;
  }

  return {
    searchTerm: parseResult.data.query ?? "",
    createdOn: parseResult.data.date ?? null,
    status: parseResult.data.status ?? "all",
    page: parseResult.data.page ?? 1,
    pageSize: merchantParcelPageSize,
  } satisfies MerchantParcelListFiltersDto;
}

function readSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export const adminParcelAssignmentFilters = [
  "all",
  "unassigned",
  "assigned",
  "need_review",
] as const;
export type AdminParcelAssignmentFilter = (typeof adminParcelAssignmentFilters)[number];

const adminParcelSearchParamsSchema = z.object({
  query: z.string().trim().max(100).optional().catch(""),
  assignment: z.enum(adminParcelAssignmentFilters).optional().catch("all"),
  township: z.string().trim().max(100).optional().catch(""),
  statuses: z.string().trim().max(200).optional().catch(""),
  page: z.coerce.number().int().min(1).optional().catch(1),
});

export type AdminParcelListFiltersDto = {
  searchTerm: string;
  assignment: AdminParcelAssignmentFilter;
  townshipName: string | null;
  statuses: ParcelStatus[];
  page: number;
  pageSize: number;
};

export type AdminParcelAssignmentCountsDto = {
  all: number;
  unassigned: number;
  assigned: number;
  need_review: number;
};

export type AdminParcelListPageDto = {
  parcels: ParcelListItemDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasAnyParcels: boolean;
  assignmentCounts: AdminParcelAssignmentCountsDto;
};

export const adminParcelPageSize = 25;

export function parcelMatchesAdminListFilters(
  parcel: ParcelListItemDto,
  filters: AdminParcelListFiltersDto,
) {
  const normalizedSearchTerm = filters.searchTerm.trim().toLowerCase();

  if (normalizedSearchTerm) {
    const matchesSearch =
      parcel.parcelCode.toLowerCase().includes(normalizedSearchTerm) ||
      parcel.receiverName.toLowerCase().includes(normalizedSearchTerm) ||
      parcel.receiverPhoneNumber.toLowerCase().includes(normalizedSearchTerm) ||
      parcel.merchantName.toLowerCase().includes(normalizedSearchTerm);

    if (!matchesSearch) {
      return false;
    }
  }

  if (filters.townshipName && parcel.townshipName !== filters.townshipName) {
    return false;
  }

  if (filters.statuses.length > 0 && !filters.statuses.includes(parcel.status)) {
    return false;
  }

  if (filters.assignment === "unassigned") {
    return parcel.riderId === null;
  }

  if (filters.assignment === "assigned") {
    return parcel.riderId !== null;
  }

  if (filters.assignment === "need_review") {
    return parcel.hasUnresolvedFailureReview;
  }

  return true;
}

export function parseAdminParcelListFilters(input: Record<string, string | string[] | undefined>) {
  const parseResult = adminParcelSearchParamsSchema.safeParse({
    query: readSearchParam(input.query),
    assignment: readSearchParam(input.assignment),
    township: readSearchParam(input.township),
    statuses: readSearchParam(input.statuses),
    page: readSearchParam(input.page),
  });

  if (!parseResult.success) {
    return {
      searchTerm: "",
      assignment: "all",
      townshipName: null,
      statuses: [],
      page: 1,
      pageSize: adminParcelPageSize,
    } satisfies AdminParcelListFiltersDto;
  }

  const township = parseResult.data.township?.trim();
  const statuses = (parseResult.data.statuses ?? "")
    .split(",")
    .map((status) => status.trim())
    .filter((status): status is ParcelStatus => isParcelStatus(status));

  return {
    searchTerm: parseResult.data.query ?? "",
    assignment: parseResult.data.assignment ?? "all",
    townshipName: township ? township : null,
    statuses,
    page: parseResult.data.page ?? 1,
    pageSize: adminParcelPageSize,
  } satisfies AdminParcelListFiltersDto;
}

export const riderParcelTabs = ["to_deliver", "delivered", "returned"] as const;
export type RiderParcelTab = (typeof riderParcelTabs)[number];

const riderParcelSearchParamsSchema = z.object({
  query: z.string().trim().max(100).optional().catch(""),
  tab: z.enum(riderParcelTabs).optional().catch("to_deliver"),
  township: z.string().trim().max(100).optional().catch(""),
  statuses: z.string().trim().max(200).optional().catch(""),
  page: z.coerce.number().int().min(1).optional().catch(1),
});

export type RiderParcelListFiltersDto = {
  searchTerm: string;
  tab: RiderParcelTab;
  townshipName: string | null;
  statuses: ParcelStatus[];
  page: number;
  pageSize: number;
};

export type RiderParcelTabCountsDto = {
  to_deliver: number;
  delivered: number;
  returned: number;
};

export type RiderParcelListPageDto = {
  parcels: ParcelListItemDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasAnyParcels: boolean;
  tabCounts: RiderParcelTabCountsDto;
};

export const riderParcelPageSize = 12;

const riderTabStatuses: Record<RiderParcelTab, ParcelStatus[]> = {
  to_deliver: ["at_office", "on_the_way", "canceled_returned"],
  delivered: ["delivered"],
  returned: ["returned_to_merchant"],
};

export function getRiderParcelTabStatuses(tab: RiderParcelTab) {
  return riderTabStatuses[tab];
}

export function parseRiderParcelListFilters(input: Record<string, string | string[] | undefined>) {
  const parseResult = riderParcelSearchParamsSchema.safeParse({
    query: readSearchParam(input.query),
    tab: readSearchParam(input.tab),
    township: readSearchParam(input.township),
    statuses: readSearchParam(input.statuses),
    page: readSearchParam(input.page),
  });

  if (!parseResult.success) {
    return {
      searchTerm: "",
      tab: "to_deliver",
      townshipName: null,
      statuses: [],
      page: 1,
      pageSize: riderParcelPageSize,
    } satisfies RiderParcelListFiltersDto;
  }

  const township = parseResult.data.township?.trim();
  const statuses = (parseResult.data.statuses ?? "")
    .split(",")
    .map((status) => status.trim())
    .filter((status): status is ParcelStatus => isParcelStatus(status));

  return {
    searchTerm: parseResult.data.query ?? "",
    tab: parseResult.data.tab ?? "to_deliver",
    townshipName: township ? township : null,
    statuses,
    page: parseResult.data.page ?? 1,
    pageSize: riderParcelPageSize,
  } satisfies RiderParcelListFiltersDto;
}
