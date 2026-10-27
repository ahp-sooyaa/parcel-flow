import { CreateTownshipSheet } from "@/features/townships/components/create-township-sheet";
import { canManageTownshipPricing } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";

export async function CreateTownshipHeaderAction() {
  const currentUser = await getCurrentUser();

  if (!currentUser || !canManageTownshipPricing(currentUser.role)) {
    return null;
  }

  return <CreateTownshipSheet />;
}
