"use server";

import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { canAccessRiderResource, parseActiveFlag, updateRiderProfileSchema } from "./utils";
import { db } from "@/db";
import { riders } from "@/db/schema";
import { requireAppAccessContext } from "@/features/auth/server/utils";
import { findTownshipById } from "@/features/townships/server/dal";
import { logAuditEvent } from "@/lib/security/audit";

export type UpdateRiderProfileActionResult = {
  ok: boolean;
  message: string;
};

export async function updateRiderProfileAction(
  _prevState: UpdateRiderProfileActionResult,
  formData: FormData,
): Promise<UpdateRiderProfileActionResult> {
  try {
    const currentUser = await requireAppAccessContext();
    const parsed = updateRiderProfileSchema.safeParse({
      riderId: formData.get("riderId"),
      townshipId: formData.get("townshipId"),
      vehicleType: formData.get("vehicleType"),
      licensePlate: formData.get("licensePlate"),
      notes: formData.get("notes"),
    });

    if (!parsed.success) {
      return { ok: false, message: "Please provide valid rider profile data." };
    }

    const canEditRider = canAccessRiderResource({
      viewerRoleSlug: currentUser.role.slug,
      viewerAppUserId: currentUser.appUserId,
      riderAppUserId: parsed.data.riderId,
      viewerPermissions: currentUser.permissions,
      permission: "rider.update",
    });

    if (!canEditRider) {
      return { ok: false, message: "Forbidden" };
    }

    if (parsed.data.townshipId) {
      const township = await findTownshipById(parsed.data.townshipId);

      if (!township?.isActive) {
        return { ok: false, message: "Selected township was not found." };
      }
    }

    const nextValues: {
      townshipId: string | null;
      vehicleType: string;
      licensePlate: string | null;
      notes: string | null;
      updatedAt: Date;
      isActive?: boolean;
    } = {
      townshipId: parsed.data.townshipId,
      vehicleType: parsed.data.vehicleType,
      licensePlate: parsed.data.licensePlate,
      notes: parsed.data.notes,
      updatedAt: new Date(),
    };

    if (currentUser.permissions.includes("rider.update")) {
      nextValues.isActive = parseActiveFlag(formData.get("isActive"));
    }

    await db
      .update(riders)
      .set(nextValues)
      .where(and(eq(riders.appUserId, parsed.data.riderId), isNull(riders.deletedAt)));

    await logAuditEvent({
      event: "rider.update",
      actorAppUserId: currentUser.appUserId,
      targetAppUserId: parsed.data.riderId,
      metadata: {
        townshipId: parsed.data.townshipId,
        riderStatusChanged: currentUser.permissions.includes("rider.update"),
      },
    });

    revalidatePath(`/dashboard/riders/${parsed.data.riderId}`);
    revalidatePath("/dashboard/riders");
    revalidatePath("/dashboard/profile");
    revalidatePath(`/dashboard/users/${parsed.data.riderId}`);
    revalidatePath(`/dashboard/users/${parsed.data.riderId}/edit`);

    return { ok: true, message: "Rider profile updated." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update rider profile.";

    return { ok: false, message };
  }
}
