import { requirePermission } from "@/features/auth/server/utils";

export default async function ParcelsPage() {
  await requirePermission("parcel-list.view");

  return <p className="text-sm text-muted-foreground">coming soon...</p>;
}
