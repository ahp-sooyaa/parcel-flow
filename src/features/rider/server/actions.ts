"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { parseActiveFlag, updateRiderProfileSchema } from "./utils";
import { getRiderAccess } from "@/features/auth/server/policies/rider";
import { requireAppAccessContext } from "@/features/auth/server/utils";
import { updateRiderProfile } from "@/features/rider/server/dal";
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

    const parsed = updateRiderProfileSchema.safeParse(Object.fromEntries(formData));

    if (!parsed.success) {
      return { ok: false, message: "Please provide valid rider profile data." };
    }

    const riderAccess = getRiderAccess({
      viewer: currentUser,
      riderAppUserId: parsed.data.riderId,
    });

    if (!riderAccess.canUpdate) {
      return { ok: false, message: "Forbidden" };
    }

    if (parsed.data.townshipId) {
      const township = await findTownshipById(parsed.data.townshipId);

      if (!township?.isActive) {
        return { ok: false, message: "Selected township was not found." };
      }
    }

    await updateRiderProfile({
      riderId: parsed.data.riderId,
      townshipId: parsed.data.townshipId,
      vehicleType: parsed.data.vehicleType,
      licensePlate: parsed.data.licensePlate,
      notes: parsed.data.notes,
      isActive: riderAccess.canManageStatus ? parseActiveFlag(formData.get("isActive")) : undefined,
    });

    await logAuditEvent({
      event: "rider.update",
      actorAppUserId: currentUser.appUserId,
      targetAppUserId: parsed.data.riderId,
      metadata: {
        townshipId: parsed.data.townshipId,
        riderStatusChanged: riderAccess.canManageStatus,
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
