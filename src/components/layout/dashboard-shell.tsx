import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppNav } from "@/components/layout/app-nav";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/session";
import { roleLabels } from "@/lib/domain";

export async function DashboardShell({ children }: Readonly<{ children: ReactNode }>) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-svh bg-background">
      <AppNav role={user.role} />
      <div className="min-w-0 flex-1">
        <header className="flex h-16 items-center justify-between border-b bg-white px-4 sm:px-6">
          <div>
            <div className="text-sm font-semibold">Parcel Flow</div>
            <div className="text-xs text-muted-foreground">After-office parcel lifecycle</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-sm sm:block">
              <div className="font-medium">{user.name}</div>
              <Badge variant="secondary">{roleLabels[user.role]}</Badge>
            </div>
          </div>
        </header>
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
