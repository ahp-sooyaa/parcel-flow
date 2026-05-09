import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Account details, bank accounts, delivery pricing, and office-level configuration."
      />
      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="bank-accounts">Bank Accounts</TabsTrigger>
          <TabsTrigger value="delivery-pricing">Delivery Pricing</TabsTrigger>
        </TabsList>
        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
              <CardDescription>Users can edit limited personal details and change their password.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Role, permissions, active status, and bank account details remain admin-managed.
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="bank-accounts">
          <Card>
            <CardHeader>
              <CardTitle>Bank Accounts</CardTitle>
              <CardDescription>Users can view bank accounts but cannot add, edit, or delete them.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Display format: KBZ Bank - Account Holder Name - ******123456
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="delivery-pricing">
          <Card>
            <CardHeader>
              <CardTitle>Delivery Pricing</CardTitle>
              <CardDescription>Super admins manage township pricing used by parcel creation.</CardDescription>
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
