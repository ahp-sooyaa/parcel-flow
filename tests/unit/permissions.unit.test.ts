import { describe, expect, test } from "bun:test";

import {
  canChangeParcelStatus,
  canCreateParcel,
  canCreateRiderPayoutDraft,
  canCreateMerchantSettlement,
  canCreateUser,
  canEditDeliveryFee,
  canManageMerchantProfiles,
  canManageRiderProfiles,
  canManageTownshipPricing,
  canManageUser,
  canResolveMerchantSettlement,
  canRegeneratePassword,
} from "@/lib/permissions";

describe("permission utilities", () => {
  test("limits user management by actor role", () => {
    expect(canManageUser("super_admin", "super_admin")).toBe(true);
    expect(canManageUser("office_admin", "merchant")).toBe(true);
    expect(canManageUser("office_admin", "super_admin")).toBe(false);
    expect(canManageUser("merchant", "rider")).toBe(false);
    expect(canRegeneratePassword("office_admin", "rider")).toBe(true);
  });

  test("limits account creation by actor role", () => {
    expect(canCreateUser("super_admin", "office_admin")).toBe(true);
    expect(canCreateUser("office_admin", "merchant")).toBe(true);
    expect(canCreateUser("office_admin", "office_admin")).toBe(false);
    expect(canCreateUser("rider", "merchant")).toBe(false);
  });

  test("limits parcel creation and rider assignment permissions to admins", () => {
    expect(canCreateParcel("super_admin")).toBe(true);
    expect(canCreateParcel("office_admin")).toBe(true);
    expect(canCreateParcel("merchant")).toBe(false);
    expect(canCreateParcel("rider")).toBe(false);
  });

  test("limits township, profile, payment, settlement, and payout management", () => {
    expect(canManageTownshipPricing("super_admin")).toBe(true);
    expect(canManageTownshipPricing("office_admin")).toBe(false);
    expect(canManageMerchantProfiles("super_admin")).toBe(true);
    expect(canManageMerchantProfiles("office_admin")).toBe(false);
    expect(canManageRiderProfiles("super_admin")).toBe(true);
    expect(canCreateMerchantSettlement("office_admin")).toBe(true);
    expect(canCreateRiderPayoutDraft("office_admin")).toBe(true);
    expect(canResolveMerchantSettlement("office_admin")).toBe(false);
    expect(canResolveMerchantSettlement("super_admin")).toBe(true);
  });

  test("limits delivery fee edits to unassigned at-office parcels for super admins", () => {
    expect(canEditDeliveryFee("super_admin", { status: "at_office", riderId: null })).toBe(true);
    expect(canEditDeliveryFee("super_admin", { status: "on_the_way", riderId: null })).toBe(false);
    expect(canEditDeliveryFee("super_admin", { status: "at_office", riderId: "rider-1" })).toBe(
      false,
    );
    expect(canEditDeliveryFee("office_admin", { status: "at_office", riderId: null })).toBe(false);
  });

  test("limits parcel status transitions by role", () => {
    expect(canChangeParcelStatus("super_admin", "delivered", "returned_to_merchant")).toBe(true);
    expect(canChangeParcelStatus("rider", "at_office", "on_the_way")).toBe(true);
    expect(canChangeParcelStatus("rider", "postpone", "on_the_way")).toBe(false);
    expect(canChangeParcelStatus("office_admin", "postpone", "on_the_way")).toBe(true);
    expect(canChangeParcelStatus("merchant", "at_office", "on_the_way")).toBe(false);
  });
});
