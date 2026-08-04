"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  Banknote,
  Bike,
  Boxes,
  LayoutDashboard,
  Menu,
  MapPinned,
  PackageCheck,
  ReceiptText,
  Settings,
  Store,
  UsersRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
  return (
    <aside className={cn("hidden w-64 shrink-0 border-r bg-[#fafaf8] lg:block", className)}>
      <AppNavContent role={role} />
    </aside>
  );
}

export function MobileAppNav({ role }: Readonly<{ role: UserRole }>) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 rounded-full border border-border/60 lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="h-svh w-screen max-w-none gap-0 border-r-0 p-0 data-[side=left]:w-screen data-[side=left]:sm:max-w-none"
      >
        <SheetTitle className="sr-only">Navigation menu</SheetTitle>
        <AppNavContent role={role} onNavigate={() => setOpen(false)} className="min-h-svh" />
      </SheetContent>
    </Sheet>
  );
}

function AppNavContent({
  className,
  onNavigate,
  role,
}: Readonly<{ className?: string; onNavigate?: () => void; role: UserRole }>) {
  const pathname = usePathname();
  const visibleNavItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <div className={cn("bg-[#fafaf8]", className)}>
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
              prefetch={true}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-white hover:text-foreground",
                isActive && "bg-white text-foreground shadow-sm ring-1 ring-border",
              )}
              onClick={onNavigate}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
