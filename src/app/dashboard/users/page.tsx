import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listUsers } from "@/features/auth/server/dal";
import { roleLabels } from "@/lib/domain";

export default async function UsersPage() {
  const users = await listUsers();

  return (
    <>
      <PageHeader
        title="Users"
        description="Admin-created user accounts for super admins, office admins, merchants, and riders."
        actions={
          <Sheet>
            <SheetTrigger asChild>
              <Button>
                <Plus className="size-4" />
                Create User
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Create User</SheetTitle>
                <SheetDescription>
                  Sheet placeholder for role assignment, initial password generation, and linked profile setup.
                </SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
        }
      />
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Password Reset</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{user.phoneNumber}</TableCell>
                <TableCell>{roleLabels[user.role]}</TableCell>
                <TableCell>
                  <Badge variant={user.isActive ? "success" : "secondary"}>{user.isActive ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell>{user.mustResetPassword ? "Required" : "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
