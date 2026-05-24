import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppNav, MobileAppNav } from "@/components/layout/app-nav";
import { DashboardAccountMenu } from "@/components/shared/dashboard-account-menu";
import { getCurrentUser } from "@/lib/session";

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
          <div className="flex items-center gap-3">
            <MobileAppNav role={user.role} />
          </div>
          <div className="flex items-center gap-3">
            <DashboardAccountMenu
              name={user.name}
              role={user.role}
              userId={user.id}
              username={user.username}
            />
          </div>
        </header>
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
