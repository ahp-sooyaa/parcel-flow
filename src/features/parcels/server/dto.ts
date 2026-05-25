import { z } from "zod";

import type { ParcelFailureNoteEntry } from "@/features/parcels/server/failure-notes";
import type { ParcelStatus, ParcelType } from "@/lib/domain";

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
  merchantId: z.string().min(1, "Merchant is required."),
  receiverName: z.string().trim().min(1, "Receiver name is required."),
  receiverPhoneNumber: z.string().trim().min(5, "Receiver phone number is required."),
  receiverAddress: z.string().trim().min(1, "Receiver address is required."),
  specialNotes: z.string().trim().optional(),
  townshipId: z.string().min(1, "Receiver township is required."),
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
