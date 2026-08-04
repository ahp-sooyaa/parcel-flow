import { LazyCreateParcelForm } from "@/features/parcels/components/lazy-create-parcel-form";
import { getCreateParcelFormOptions } from "@/features/parcels/server/form-options";

export async function CreateParcelFormLoader() {
  const { merchants, townships } = await getCreateParcelFormOptions();

  return <LazyCreateParcelForm merchants={merchants} townships={townships} />;
}
