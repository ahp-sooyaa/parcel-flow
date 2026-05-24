import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function Progress({
  className,
  indicatorClassName,
  value = 0,
  max = 100,
  ...props
}: ComponentProps<"div"> & {
  indicatorClassName?: string;
  value?: number;
  max?: number;
}) {
  const safeMax = max > 0 ? max : 100;
  const safeValue = Number.isFinite(value) ? Math.min(Math.max(value, 0), safeMax) : 0;
  const percentage = (safeValue / safeMax) * 100;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={Math.round(safeValue)}
      data-slot="progress"
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className={cn("h-full rounded-full bg-primary transition-[width]", indicatorClassName)}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

export { Progress };
