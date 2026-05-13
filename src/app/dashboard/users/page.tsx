import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { CreateUserForm } from "@/features/users/components/create-user-form";
import { UserListTable } from "@/features/users/components/user-list-table";
import { listBankAccountsForUser, listUsers } from "@/features/users/server/dal";
import { listTownships } from "@/features/townships/server/dal";
import { getCurrentUser } from "@/lib/session";

export default async function UsersPage() {
  const [users, townships, currentUser] = await Promise.all([
    listUsers(),
    listTownships(),
    getCurrentUser(),
  ]);
  const bankAccountsByUserId = Object.fromEntries(
    await Promise.all(
      users.map(async (user) => [user.id, await listBankAccountsForUser(user.id)] as const),
    ),
  );

  return (
    <>
      <PageHeader
        title="Users"
        description="Admin-created user accounts for super admins, office admins, merchants, and riders."
        actions={
          <Sheet>
            <Button asChild>
              <SheetTrigger>
                <Plus className="size-4" />
                Create User
              </SheetTrigger>
            </Button>
            <SheetContent className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:w-[500px] data-[side=right]:sm:max-w-[500px]">
              <CreateUserForm townships={townships} />
            </SheetContent>
          </Sheet>
        }
      />

      <UserListTable
        users={users}
        bankAccountsByUserId={bankAccountsByUserId}
        townships={townships}
        currentUserPhoneNumber={currentUser?.phoneNumber ?? null}
      />
    </>
  );
}
