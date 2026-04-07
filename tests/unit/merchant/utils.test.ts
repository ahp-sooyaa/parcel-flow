import { describe, expect, it } from "vitest";
import { canAccessMerchantResource } from "@/features/merchant/server/utils";

describe("canAccessMerchantResource", () => {
  it("allows admin access when merchant.update permission is present", () => {
    expect(
      canAccessMerchantResource({
        viewerRoleSlug: "office_admin",
        viewerAppUserId: "admin-1",
        merchantAppUserId: "merchant-1",
        viewerPermissions: ["merchant.update"],
        permission: "merchant.update",
      }),
    ).toBe(true);
  });

  it("allows merchant self access without direct merchant permission", () => {
    expect(
      canAccessMerchantResource({
        viewerRoleSlug: "merchant",
        viewerAppUserId: "merchant-1",
        merchantAppUserId: "merchant-1",
      }),
    ).toBe(true);
  });

  it("denies merchant access to another merchant record", () => {
    expect(
      canAccessMerchantResource({
        viewerRoleSlug: "merchant",
        viewerAppUserId: "merchant-1",
        merchantAppUserId: "merchant-2",
      }),
    ).toBe(false);
  });

  it("does not treat merchant self-service permissions as global merchant access", () => {
    expect(
      canAccessMerchantResource({
        viewerRoleSlug: "merchant",
        viewerAppUserId: "merchant-1",
        merchantAppUserId: "merchant-2",
        viewerPermissions: ["merchant.view", "merchant.update"],
        permission: "merchant.view",
      }),
    ).toBe(false);
  });
});
