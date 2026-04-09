import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { toDashboardShellUserDto } from "@/features/auth/server/dto";
import { requireAppAccessContext } from "@/features/auth/server/utils";

import type { ReactNode } from "react";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default async function DashboardLayout({ children }: Readonly<DashboardLayoutProps>) {
  let currentUser;
  try {
    currentUser = await requireAppAccessContext();
  } catch {
    redirect("/sign-in");
  }

  const shellUser = toDashboardShellUserDto(currentUser);

  return <DashboardShell user={shellUser}>{children}</DashboardShell>;
}
