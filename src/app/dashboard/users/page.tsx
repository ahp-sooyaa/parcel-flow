import { Suspense } from "react";

import { PageLoading } from "@/components/shared/page-loading";
import { PageHeader } from "@/components/shared/page-header";
import { SheetFormFallback } from "@/components/shared/sheet-form-fallback";
import { CreateUserFormLoader } from "@/features/users/components/create-user-form-loader";
import { CreateUserSheet } from "@/features/users/components/create-user-sheet";
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
    <div data-testid="page-dynamic-content">
      <UserListTable
        pageResult={pageResult}
        filters={filters}
        bankAccountsByUserId={bankAccountsByUserId}
        townships={townships}
        currentUserPhoneNumber={currentUser?.phoneNumber ?? null}
      />
    </div>
  );
}

export default function UsersPage(props: Readonly<Parameters<typeof UsersPageContent>[0]>) {
  return (
    <>
      <PageHeader
        title="Users"
        description="Admin-created user accounts for super admins, office admins, merchants, and riders."
        actions={
          <CreateUserSheet triggerLabel="Create User">
            <Suspense fallback={<SheetFormFallback />}>
              <CreateUserFormLoader />
            </Suspense>
          </CreateUserSheet>
        }
      />
      <Suspense fallback={<PageLoading />}>
        <UsersPageContent {...props} />
      </Suspense>
    </>
  );
}
