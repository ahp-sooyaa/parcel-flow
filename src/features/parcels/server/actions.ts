"use server";

import { createParcelFormInputSchema } from "@/features/parcels/server/dto";
import { mapCreateParcelFormInputToCreateParcelInput } from "@/features/parcels/server/utils";
import { canCreateParcel } from "@/lib/permissions";
import { requireCurrentUser } from "@/lib/session";

export async function createParcelAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parseResult = createParcelFormInputSchema.safeParse(input);

  if (!parseResult.success) {
    return {
      ok: false as const,
      message: parseResult.error.issues[0]?.message ?? "Invalid parcel details.",
    };
  }

  if (!canCreateParcel(actor.role)) {
    return {
      ok: false as const,
      message: "You do not have permission to create parcels.",
    };
  }

  const validatedInput = parseResult.data;
  const parcel = mapCreateParcelFormInputToCreateParcelInput(validatedInput);

  return {
    ok: true as const,
    message: "Parcel details validated.",
    parcel,
  };
}
