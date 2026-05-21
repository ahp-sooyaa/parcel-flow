import type { CurrentUser } from "@/lib/session";
import { userRoles } from "@/lib/domain";
import type { ParcelListItemDto } from "@/features/parcels/server/dto";
import type { RiderListItemDto } from "@/features/riders/server/dto";
import type { UserListItemDto } from "@/features/users/server/dto";

export const testRunId = process.env.TEST_RUN_ID ?? `test-${Date.now()}`;

export function uniqueTestId(label: string) {
  return `${testRunId}-${label}-${crypto.randomUUID()}`;
}

export function buildCurrentUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  const role = overrides.role ?? "super_admin";

  return {
    id: overrides.id ?? uniqueTestId("user"),
    name: overrides.name ?? "Test User",
    username: overrides.username ?? `${testRunId}-${role}`,
    email: overrides.email ?? `${testRunId}-${role}@internal.parcel-flow.test`,
    phoneNumber: overrides.phoneNumber ?? "09999999999",
    address: overrides.address ?? "Test address",
    age: overrides.age ?? null,
    role,
    isActive: overrides.isActive ?? true,
    mustResetPassword: overrides.mustResetPassword ?? false,
  };
}

export function buildSessionUser(overrides: Partial<CurrentUser> = {}) {
  return {
    session: {
      id: uniqueTestId("session"),
      userId: overrides.id ?? uniqueTestId("user"),
      token: uniqueTestId("token"),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    user: buildCurrentUser(overrides),
  };
}

export function buildUserListItem(overrides: Partial<UserListItemDto> = {}): UserListItemDto {
  const role = overrides.role ?? "merchant";

  return {
    id: overrides.id ?? uniqueTestId("list-user"),
    name: overrides.name ?? "Test List User",
    phoneNumber: overrides.phoneNumber ?? "09999999998",
    address: overrides.address ?? "Test address",
    age: overrides.age ?? null,
    role,
    shopName: overrides.shopName ?? (role === "merchant" ? "Test Shop" : null),
    serviceTownshipId: overrides.serviceTownshipId ?? null,
    serviceTownshipName: overrides.serviceTownshipName ?? null,
    isActive: overrides.isActive ?? true,
    mustResetPassword: overrides.mustResetPassword ?? false,
  };
}

export function buildParcelListItem(overrides: Partial<ParcelListItemDto> = {}): ParcelListItemDto {
  return {
    id: overrides.id ?? uniqueTestId("parcel"),
    parcelCode: overrides.parcelCode ?? "PF-000001-000001",
    merchantName: overrides.merchantName ?? "Test Merchant",
    receiverName: overrides.receiverName ?? "Receiver",
    receiverPhoneNumber: overrides.receiverPhoneNumber ?? "09123456789",
    receiverAddress: overrides.receiverAddress ?? "Receiver address",
    specialNotes: overrides.specialNotes ?? null,
    deliveryFailureNote: overrides.deliveryFailureNote ?? null,
    townshipName: overrides.townshipName ?? "Test Township",
    codAmount: overrides.codAmount ?? 10_000,
    deliveryFee: overrides.deliveryFee ?? 2_000,
    proofOfDeliveryImagesKeys: overrides.proofOfDeliveryImagesKeys ?? [],
    status: overrides.status ?? "at_office",
    riderName: overrides.riderName ?? null,
    hasUnresolvedFailureReview: overrides.hasUnresolvedFailureReview ?? false,
    createdAt: overrides.createdAt ?? "2026-01-01",
  };
}

export function buildRiderListItem(overrides: Partial<RiderListItemDto> = {}): RiderListItemDto {
  return {
    id: overrides.id ?? uniqueTestId("rider"),
    name: overrides.name ?? "Test Rider",
    phoneNumber: overrides.phoneNumber ?? "09999999997",
    serviceTownships: overrides.serviceTownships ?? ["Test Township"],
    expectedCollection: overrides.expectedCollection ?? 5_000,
    actualCollection: overrides.actualCollection ?? 0,
    activeParcelCount: overrides.activeParcelCount ?? 1,
  };
}

export function buildCreateUserInput(overrides: Record<string, unknown> = {}) {
  const role = userRoles.find((candidate) => candidate === overrides.role) ?? "merchant";

  return {
    name: "Test Merchant",
    phoneNumber: "09999999996",
    address: "Merchant address",
    age: 30,
    role,
    password: "password123",
    isActive: true,
    shopName: role === "merchant" ? "Test Shop" : undefined,
    serviceTownshipId: role === "rider" ? uniqueTestId("township") : undefined,
    ...overrides,
  };
}
