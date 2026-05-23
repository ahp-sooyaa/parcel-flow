"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  Bike,
  Boxes,
  LayoutDashboard,
  MapPinned,
  PackageCheck,
  ReceiptText,
  Settings,
  Store,
  UsersRound,
} from "lucide-react";

import type { UserRole } from "@/lib/domain";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, roles: ["super_admin"] },
  {
    href: "/dashboard/parcels",
    label: "Parcels",
    icon: Boxes,
    roles: ["super_admin", "office_admin"],
  },
  { href: "/dashboard/merchants", label: "Merchants", icon: Store, roles: ["super_admin"] },
  { href: "/dashboard/riders", label: "Riders", icon: Bike, roles: ["super_admin"] },
  {
    href: "/dashboard/settlements",
    label: "Settlements",
    icon: ReceiptText,
    roles: ["super_admin", "office_admin"],
  },
  {
    href: "/dashboard/rider-payouts",
    label: "Rider Payouts",
    icon: Banknote,
    roles: ["super_admin", "office_admin"],
  },
  { href: "/dashboard/townships", label: "Townships", icon: MapPinned, roles: ["super_admin"] },
  {
    href: "/dashboard/users",
    label: "Users",
    icon: UsersRound,
    roles: ["super_admin", "office_admin"],
  },
  {
    href: "/dashboard/merchant/overview",
    label: "Overview",
    icon: LayoutDashboard,
    roles: ["merchant"],
  },
  {
    href: "/dashboard/merchant/parcels",
    label: "My Parcels",
    icon: Boxes,
    roles: ["merchant"],
  },
  {
    href: "/dashboard/rider/parcels",
    label: "My Parcels",
    icon: Boxes,
    roles: ["rider"],
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings,
    roles: ["super_admin", "office_admin", "merchant", "rider"],
  },
];

export function AppNav({ className, role }: Readonly<{ className?: string; role: UserRole }>) {
  const pathname = usePathname();
  const visibleNavItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <aside className={cn("hidden w-64 shrink-0 border-r bg-[#fafaf8] lg:block", className)}>
      <div className="flex h-16 items-center gap-3 border-b px-5">
        <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <PackageCheck className="size-5" />
        </div>
        <div>
          <div className="text-sm font-semibold">Parcel Flow</div>
          <div className="text-xs text-muted-foreground">Office operations</div>
        </div>
      </div>
      <nav className="space-y-1 p-3">
        {visibleNavItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-white hover:text-foreground",
                isActive && "bg-white text-foreground shadow-sm ring-1 ring-border",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
