import type { VariantProps } from "class-variance-authority";

import { Badge, badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusBadgeProps = Readonly<{
  label: string;
  className?: string;
  variant?: VariantProps<typeof badgeVariants>["variant"];
}>;

export function StatusBadge({ label, className, variant = "default" }: StatusBadgeProps) {
  return (
    <Badge variant={variant} className={cn("rounded-[5px] border-0 shadow-xs", className)}>
      {label}
    </Badge>
  );
}
