import { describe, expect, it } from "vitest";
import { canAccessRiderResource } from "@/features/rider/server/utils";

describe("canAccessRiderResource", () => {
  it("allows admin access when rider.update permission is present", () => {
    expect(
      canAccessRiderResource({
        viewerRoleSlug: "office_admin",
        viewerAppUserId: "admin-1",
        riderAppUserId: "rider-1",
        viewerPermissions: ["rider.update"],
        permission: "rider.update",
      }),
    ).toBe(true);
  });

  it("allows rider self access without direct rider permission", () => {
    expect(
      canAccessRiderResource({
        viewerRoleSlug: "rider",
        viewerAppUserId: "rider-1",
        riderAppUserId: "rider-1",
      }),
    ).toBe(true);
  });

  it("denies rider access to another rider record", () => {
    expect(
      canAccessRiderResource({
        viewerRoleSlug: "rider",
        viewerAppUserId: "rider-1",
        riderAppUserId: "rider-2",
      }),
    ).toBe(false);
  });

  it("does not treat rider self-service permissions as global rider access", () => {
    expect(
      canAccessRiderResource({
        viewerRoleSlug: "rider",
        viewerAppUserId: "rider-1",
        riderAppUserId: "rider-2",
        viewerPermissions: ["rider.view", "rider.update"],
        permission: "rider.view",
      }),
    ).toBe(false);
  });
});
