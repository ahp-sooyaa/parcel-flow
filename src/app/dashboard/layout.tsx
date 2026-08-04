import type { ReactNode } from "react";
import { Suspense } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { DashboardShellFallback } from "@/components/layout/dashboard-shell-fallback";

export default function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Suspense fallback={<DashboardShellFallback />}>
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}
