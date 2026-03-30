import { requirePermission } from "@/features/auth/server/utils";

export default async function RidersPage() {
  await requirePermission("rider-list.view");

  return <p className="text-sm text-muted-foreground">coming soon...</p>;
}
