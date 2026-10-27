import type { ReactNode } from "react";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AppNav, MobileAppNav } from "@/components/layout/app-nav";
import { DashboardAccountMenu } from "@/components/shared/dashboard-account-menu";
import { isDemoMode } from "@/lib/demo";
import { getCurrentUser } from "@/lib/session";

const GITHUB_URL = "https://github.com/ahp-sooyaa/parcel-flow";

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

function DemoBanner() {
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-[#1b1938] px-4 py-2 text-center text-xs text-[#d9d6e6] sm:text-sm"
      data-testid="demo-banner"
    >
      <span>
        <strong className="font-semibold text-white">Demo</strong> · data resets daily at 00:00
        Yangon time · some actions are disabled
      </span>
      <a
        href={GITHUB_URL}
        className="font-medium text-[#c9b4fa] underline-offset-4 hover:underline"
      >
        View source on GitHub
      </a>
    </div>
  );
}

export function DashboardShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-svh bg-background" data-testid="dashboard-shell">
      {isDemoMode() ? <DemoBanner /> : null}
      <div className="flex">
        <Suspense
          fallback={
            <aside className="hidden w-64 shrink-0 self-start border-r bg-[#fafaf8] lg:sticky lg:top-0 lg:block lg:h-svh" />
          }
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
    </div>
  );
}
