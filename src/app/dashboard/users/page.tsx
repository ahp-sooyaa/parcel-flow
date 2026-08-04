import { Suspense } from "react";

import { PageLoading } from "@/components/shared/page-loading";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { CreateUserForm } from "@/features/users/components/create-user-form";
import { UserListTable } from "@/features/users/components/user-list-table";
import { listBankAccountsForUserIds, listUsersPage } from "@/features/users/server/dal";
import { parseUserListFilters } from "@/features/users/server/dto";
import { listTownships } from "@/features/townships/server/dal";
import { isAdminRole } from "@/lib/domain";
import { requireCurrentUser } from "@/lib/session";

type UsersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function UsersPageContent({ searchParams }: Readonly<UsersPageProps>) {
  const currentUser = await requireCurrentUser();

  if (!isAdminRole(currentUser.role)) {
    throw new Error("Admin access required.");
  }

  const filters = parseUserListFilters((await searchParams) ?? {});
  const [pageResult, townships] = await Promise.all([listUsersPage(filters), listTownships()]);
  const bankAccountsByUserId = Object.fromEntries(
    (await listBankAccountsForUserIds(pageResult.users.map((user) => user.id))).entries(),
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
        pageResult={pageResult}
        filters={filters}
        bankAccountsByUserId={bankAccountsByUserId}
        townships={townships}
        currentUserPhoneNumber={currentUser?.phoneNumber ?? null}
      />
    </>
  );
}

export default function UsersPage(props: Readonly<Parameters<typeof UsersPageContent>[0]>) {
  return (
    <Suspense fallback={<PageLoading />}>
      <UsersPageContent {...props} />
    </Suspense>
  );
}
