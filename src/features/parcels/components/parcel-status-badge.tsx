import { Badge } from "@/components/ui/badge";
import { parcelStatusLabels, type ParcelStatus } from "@/lib/domain";

export function ParcelStatusBadge({ status }: { status: ParcelStatus }) {
  const variant = status === "delivered" ? "success" : status === "at_office" ? "secondary" : "warning";

  return <Badge variant={variant}>{parcelStatusLabels[status]}</Badge>;
}
