import { requirePermission } from "@/features/auth/server/utils";

type MerchantDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function MerchantDetailPage({ params }: MerchantDetailPageProps) {
  await requirePermission("merchant.view");

  const { id } = await params;

  return (
    <p className="text-sm text-muted-foreground">merchant detail page coming soon... ({id})</p>
  );
}
