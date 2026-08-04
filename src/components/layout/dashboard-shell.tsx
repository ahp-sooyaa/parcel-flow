import type { ReactNode } from "react";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AppNav, MobileAppNav } from "@/components/layout/app-nav";
import { DashboardAccountMenu } from "@/components/shared/dashboard-account-menu";
import { getCurrentUser } from "@/lib/session";

async function AuthGate() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return null;
}

async function DesktopNav() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  return <AppNav role={user.role} />;
}

async function MobileNav() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  return <MobileAppNav role={user.role} />;
}

async function AccountMenu() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  return (
    <DashboardAccountMenu
      name={user.name}
      role={user.role}
      userId={user.id}
      username={user.username}
    />
  );
}

export function DashboardShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex min-h-svh bg-background" data-testid="dashboard-shell">
      <Suspense
        fallback={<aside className="hidden w-64 shrink-0 border-r bg-[#fafaf8] lg:block" />}
      >
        <DesktopNav />
      </Suspense>
      <div className="min-w-0 flex-1">
        <header className="flex h-16 items-center justify-between border-b bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Suspense fallback={null}>
              <MobileNav />
            </Suspense>
          </div>
          <div className="flex items-center gap-3">
            <Suspense fallback={<div className="h-8 w-28 animate-pulse rounded-md bg-muted" />}>
              <AccountMenu />
            </Suspense>
          </div>
        </header>
        <main className="p-4 sm:p-6">
          <Suspense fallback={null}>
            <AuthGate />
          </Suspense>
          {children}
        </main>
      </div>
    </div>
  );
}
