import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { toDashboardShellUserDto } from "@/features/auth/server/dto";
import { getCurrentUserContext } from "@/features/auth/server/utils";

import type { ReactNode } from "react";

type DashboardLayoutProps = {
  children: ReactNode;
};

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return <DashboardShellGuard>{children}</DashboardShellGuard>;
}

async function DashboardShellGuard({ children }: DashboardLayoutProps) {
  const currentUser = await getCurrentUserContext();

  if (!currentUser) {
    redirect("/sign-in");
  }

  const shellUser = toDashboardShellUserDto(currentUser);

  return <DashboardShell user={shellUser}>{children}</DashboardShell>;
}
