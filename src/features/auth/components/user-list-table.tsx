"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";

import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { UserListItemDto } from "@/features/auth/server/dto";
import { EditUserForm } from "@/features/auth/components/edit-user-form";
import type { TownshipListItemDto } from "@/features/townships/server/dto";
import { roleLabels } from "@/lib/domain";

export function UserListTable({
  users,
  townships,
  currentUserPhoneNumber,
}: Readonly<{
  users: UserListItemDto[];
  townships: TownshipListItemDto[];
  currentUserPhoneNumber: string | null;
}>) {
  const router = useRouter();
  const [viewingUser, setViewingUser] = useState<UserListItemDto | null>(null);
  const [editingUser, setEditingUser] = useState<UserListItemDto | null>(null);

  return (
    <>
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Password Reset</TableHead>
              <TableHead className="w-12 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const isCurrentUser = currentUserPhoneNumber === user.phoneNumber;

              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.phoneNumber}</TableCell>
                  <TableCell>{roleLabels[user.role]}</TableCell>
                  <TableCell>
                    <StatusBadge
                      label={user.isActive ? "Active" : "Inactive"}
                      variant={user.isActive ? "success" : "secondary"}
                    />
                  </TableCell>
                  <TableCell>{user.mustResetPassword ? "Required" : "-"}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-md text-muted-foreground"
                          aria-label={`Open actions for ${user.name}`}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[11rem]">
                        {isCurrentUser ? (
                          <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
                            Manage in Settings
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => setEditingUser(user)}>
                            Edit
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setViewingUser(user)}>
                          View
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={viewingUser !== null} onOpenChange={(open) => !open && setViewingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>Review the current user account information.</DialogDescription>
          </DialogHeader>

          {viewingUser && (
            <div className="space-y-4">
              <DetailRow label="Name" value={viewingUser.name} />
              <DetailRow label="Phone number" value={viewingUser.phoneNumber} />
              <DetailRow label="Address" value={viewingUser.address} />
              <DetailRow label="Age" value={viewingUser.age ? String(viewingUser.age) : "-"} />
              <DetailRow label="Role" value={roleLabels[viewingUser.role]} />
              {viewingUser.shopName && <DetailRow label="Shop" value={viewingUser.shopName} />}
              {viewingUser.serviceTownshipName && (
                <DetailRow label="Service township" value={viewingUser.serviceTownshipName} />
              )}
              <DetailRow label="Status" value={viewingUser.isActive ? "Active" : "Inactive"} />
              <DetailRow
                label="Password reset"
                value={viewingUser.mustResetPassword ? "Required" : "Not required"}
              />
            </div>
          )}

          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>

      <Sheet open={editingUser !== null} onOpenChange={(open) => !open && setEditingUser(null)}>
        <SheetContent className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:w-[500px] data-[side=right]:sm:max-w-[500px]">
          {editingUser && <EditUserForm user={editingUser} townships={townships} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function DetailRow({
  label,
  value,
}: Readonly<{
  label: string;
  value: string;
}>) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-right text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}
