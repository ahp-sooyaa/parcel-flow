"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { LogOut } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/features/auth/server/actions";
import { roleLabels, type UserRole } from "@/lib/domain";

const Facehash = dynamic(() => import("facehash").then((module) => module.Facehash), {
  ssr: false,
  loading: () => null,
});

type DashboardAccountMenuProps = {
  name: string;
  role: UserRole;
  userId: string;
  username: string;
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function DashboardAccountMenu({
  name,
  role,
  userId,
  username,
}: Readonly<DashboardAccountMenuProps>) {
  const [isSigningOut, startSignOutTransition] = useTransition();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const avatarSeed = `${userId}:${username}`;

  function handleSignOut() {
    setSignOutError(null);

    startSignOutTransition(async () => {
      try {
        await signOutAction();
      } catch (error) {
        setSignOutError(error instanceof Error ? error.message : "Unable to sign out.");
      }
    });
  }

  return (
    <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 rounded-full border border-border/60"
          aria-label="Open account menu"
        >
          <Avatar className="size-9">
            <AvatarFallback className="bg-muted text-xs font-medium text-foreground">
              {isMenuOpen ? (
                <Facehash
                  name={avatarSeed}
                  size={36}
                  interactive={true}
                  enableBlink={true}
                  showInitial={true}
                  intensity3d="dramatic"
                />
              ) : (
                getInitials(name)
              )}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <div className="space-y-2 px-3 py-2">
          <div className="text-sm font-medium text-foreground">{name}</div>
          <Badge variant="secondary">{roleLabels[role]}</Badge>
        </div>
        <DropdownMenuSeparator />
        {signOutError ? (
          <div className="px-3 pb-2 text-xs text-destructive">{signOutError}</div>
        ) : null}
        <DropdownMenuItem
          variant="destructive"
          disabled={isSigningOut}
          onClick={() => {
            handleSignOut();
          }}
        >
          <LogOut className="size-4" />
          {isSigningOut ? "Signing out..." : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
