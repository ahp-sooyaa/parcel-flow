"use client";

import {
  LayoutDashboard,
  MapPinned,
  Menu,
  PackageSearch,
  Store,
  Truck,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AppBrand } from "@/components/shared/app-brand";
import { ResetRequiredBanner } from "@/components/shared/reset-required-banner";
import { UserSummary } from "@/components/shared/user-summary";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DashboardShellProps = {
  children: ReactNode;
  user: {
    name: string;
    roleLabel: string;
    navItems: {
      key:
        | "dashboard"
        | "users"
        | "merchants"
        | "my-merchant"
        | "riders"
        | "my-rider"
        | "parcels"
        | "townships";
      href: string;
      label: string;
    }[];
    mustResetPassword: boolean;
  };
};

const navIconByKey: Record<DashboardShellProps["user"]["navItems"][number]["key"], ReactNode> = {
  dashboard: <LayoutDashboard className="h-4 w-4" />,
  users: <Users className="h-4 w-4" />,
  merchants: <Store className="h-4 w-4" />,
  "my-merchant": <Store className="h-4 w-4" />,
  riders: <Truck className="h-4 w-4" />,
  "my-rider": <Truck className="h-4 w-4" />,
  parcels: <PackageSearch className="h-4 w-4" />,
  townships: <MapPinned className="h-4 w-4" />,
};

export function DashboardShell({ children, user }: Readonly<DashboardShellProps>) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-muted/40">
      {isSidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-label="Close menu"
          onClick={() => setIsSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 border-r bg-sidebar px-4 py-6 transition-transform duration-200",
          "md:static md:translate-x-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="mb-4 flex items-center justify-between md:mb-0 md:block">
          <AppBrand />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X />
          </Button>
        </div>
        <nav className="mt-8 flex flex-col gap-1">
          {user.navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                {navIconByKey[item.key]}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-8 border-t pt-4">
          <UserSummary name={user.name} role={user.roleLabel} />
        </div>
      </aside>
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center gap-3 border-b bg-card px-4 py-3 md:px-6 md:py-4">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu />
          </Button>
          <p className="text-sm text-muted-foreground">Delivery Operations Dashboard</p>
        </header>
        <main className="flex-1 px-4 py-4 md:px-6 md:py-6">
          <ResetRequiredBanner enabled={user.mustResetPassword} />
          {children}
        </main>
      </div>
    </div>
  );
}
