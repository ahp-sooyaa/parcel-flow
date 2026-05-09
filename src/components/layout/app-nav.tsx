"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  Bike,
  Boxes,
  ContactRound,
  LayoutDashboard,
  MapPinned,
  PackageCheck,
  ReceiptText,
  Settings,
  Store,
  UsersRound,
} from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/parcels", label: "Parcels", icon: Boxes },
  { href: "/dashboard/merchants", label: "Merchants", icon: Store },
  { href: "/dashboard/riders", label: "Riders", icon: Bike },
  { href: "/dashboard/settlements", label: "Settlements", icon: ReceiptText },
  { href: "/dashboard/rider-payouts", label: "Rider Payouts", icon: Banknote },
  { href: "/dashboard/townships", label: "Townships", icon: MapPinned },
  { href: "/dashboard/merchant-contacts", label: "Contacts", icon: ContactRound },
  { href: "/dashboard/users", label: "Users", icon: UsersRound },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function AppNav({ className }: Readonly<{ className?: string }>) {
  const pathname = usePathname();

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
        {navItems.map((item) => {
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
