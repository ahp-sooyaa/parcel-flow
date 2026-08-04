import { Suspense } from "react";

import { PageLoading } from "@/components/shared/page-loading";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountSettingsForm } from "@/features/users/components/account-settings-form";
import { BankAccountsSettings } from "@/features/users/components/bank-accounts-settings";
import { getUserById, listBankAccountsForUser } from "@/features/users/server/dal";
import type { UserListItemDto } from "@/features/users/server/dto";
import { requireCurrentUser } from "@/lib/session";

async function SettingsPageContent() {
  const currentUser = await requireCurrentUser();
  const settingsUser = (await getUserById(currentUser.id)) ?? buildSettingsUser(currentUser);
  const bankAccounts = await listBankAccountsForUser(settingsUser.id);

  return (
    <div data-testid="page-dynamic-content">
      <Tabs defaultValue="account" className="gap-4">
        <TabsList className="rounded-lg border border-border bg-[#f3f2ef] p-1">
          <TabsTrigger
            value="account"
            className="rounded-md border-0 px-4 text-sm data-active:bg-white"
          >
            Account
          </TabsTrigger>
          <TabsTrigger
            value="bank-accounts"
            className="rounded-md border-0 px-4 text-sm data-active:bg-white"
          >
            Bank Accounts
          </TabsTrigger>
        </TabsList>
        <TabsContent value="account">
          {settingsUser && <AccountSettingsForm user={settingsUser} />}
        </TabsContent>
        <TabsContent value="bank-accounts">
          {settingsUser && (
            <BankAccountsSettings user={settingsUser} initialBankAccounts={bankAccounts} />
          )}
        </TabsContent>
        <TabsContent value="delivery-pricing">
          <Card>
            <CardHeader>
              <CardTitle>Delivery Pricing</CardTitle>
              <CardDescription>
                Super admins manage township pricing used by parcel creation.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Office admins can use pricing but cannot manually override delivery fees.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// this function we may not need if we fetch real data from database and auth.
// no need to compare currentUser with userlist
function buildSettingsUser(
  currentUser: Awaited<ReturnType<typeof requireCurrentUser>>,
): UserListItemDto {
  return {
    id: currentUser.id,
    name: currentUser.name,
    phoneNumber: currentUser.phoneNumber,
    address: currentUser.address,
    age: currentUser.age,
    role: currentUser.role,
    shopName: null,
    serviceTownshipId: null,
    serviceTownshipName: null,
    isActive: currentUser.isActive,
    mustResetPassword: currentUser.mustResetPassword,
  };
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Account details, bank accounts, delivery pricing, and office-level configuration."
      />
      <Suspense fallback={<PageLoading />}>
        <SettingsPageContent />
      </Suspense>
    </>
  );
}
