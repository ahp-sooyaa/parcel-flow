import { LazyCreateParcelForm } from "@/features/parcels/components/lazy-create-parcel-form";
import { getCreateParcelFormOptions } from "@/features/parcels/server/form-options";
import { getCurrentUser } from "@/lib/session";

export async function CreateParcelFormLoader() {
  await getCurrentUser();
  const { merchants, townships } = await getCreateParcelFormOptions();

  return <LazyCreateParcelForm merchants={merchants} townships={townships} />;
}
