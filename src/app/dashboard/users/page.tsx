import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { CreateUserForm } from "@/features/auth/components/create-user-form";
import { UserListTable } from "@/features/auth/components/user-list-table";
import { listUsers } from "@/features/auth/server/dal";
import { listTownships } from "@/features/townships/server/dal";
import { getCurrentUser } from "@/lib/session";

export default async function UsersPage() {
  const [users, townships, currentUser] = await Promise.all([
    listUsers(),
    listTownships(),
    getCurrentUser(),
  ]);

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
            <SheetContent className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:w-[500px] data-[side=right]:sm:max-w-[500px]">
              <CreateUserForm townships={townships} />
            </SheetContent>
          </Sheet>
        }
      />

      <UserListTable
        users={users}
        townships={townships}
        currentUserPhoneNumber={currentUser?.phoneNumber ?? null}
      />
    </>
  );
}
