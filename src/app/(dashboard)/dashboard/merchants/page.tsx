import { requirePermission } from "@/features/auth/server/utils";

export default async function MerchantsPage() {
  await requirePermission("merchant-list.view");

  return <p className="text-sm text-muted-foreground">merchant list coming soon...</p>;
}
