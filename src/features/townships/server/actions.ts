"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createTownship } from "./dal";
import { createTownshipSchema } from "./utils";
import { requirePermission } from "@/features/auth/server/utils";
import { logAuditEvent } from "@/lib/security/audit";

import type { CreateTownshipActionResult } from "./dto";

export async function createTownshipAction(
  _prevState: CreateTownshipActionResult,
  formData: FormData,
): Promise<CreateTownshipActionResult> {
  try {
    const currentUser = await requirePermission("township.create");

    const parsed = createTownshipSchema.safeParse(Object.fromEntries(formData));

    if (!parsed.success) {
      return { ok: false, message: "Please provide valid township details." };
    }

    const created = await createTownship(parsed.data);

    await logAuditEvent({
      event: "township.create",
      actorAppUserId: currentUser.appUserId,
      metadata: {
        isActive: parsed.data.isActive,
      },
    });

    revalidatePath("/dashboard/townships");
    revalidatePath("/dashboard/users/create");

    return {
      ok: true,
      message: "Township created successfully.",
      townshipId: created.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create township.";

    return { ok: false, message };
  }
}
