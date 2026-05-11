import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountSettingsForm } from "@/features/auth/components/account-settings-form";
import { BankAccountsSettings } from "@/features/auth/components/bank-accounts-settings";
// i think listBankAccountsForUser should be in feature/
import { listBankAccountsForUser, listUsers } from "@/features/auth/server/dal";
import type { UserListItemDto } from "@/features/auth/server/dto";
import { getCurrentUser } from "@/lib/session";

export default async function SettingsPage() {
  const [currentUser, users] = await Promise.all([getCurrentUser(), listUsers()]);
  const settingsUser = buildSettingsUser(currentUser, users);
  const bankAccounts = settingsUser ? await listBankAccountsForUser(settingsUser.id) : [];

  return (
    <>
      <PageHeader
        title="Settings"
        description="Account details, bank accounts, delivery pricing, and office-level configuration."
      />
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
          <TabsTrigger
            value="delivery-pricing"
            className="rounded-md border-0 px-4 text-sm data-active:bg-white"
          >
            Delivery Pricing
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
    </>
  );
}

// this function we may not need if we fetch real data from database and auth.
// no need to compare currentUser with userlist
function buildSettingsUser(
  currentUser: Awaited<ReturnType<typeof getCurrentUser>>,
  users: UserListItemDto[],
) {
  if (!currentUser) {
    return null;
  }

  const matchedUser = users.find((user) => user.phoneNumber === currentUser.phoneNumber);

  if (matchedUser) {
    return matchedUser;
  }

  return {
    id: currentUser.id,
    name: currentUser.name,
    phoneNumber: currentUser.phoneNumber,
    address: "",
    age: null,
    role: currentUser.role,
    shopName: null,
    serviceTownshipId: null,
    serviceTownshipName: null,
    isActive: true,
    mustResetPassword: false,
  };
}
