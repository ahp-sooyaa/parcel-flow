import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_ACCOUNTS, type DemoRole } from "@/lib/demo";

const demoRoleLabels: Record<DemoRole, string> = {
  admin: "Admin",
  merchant: "Merchant",
  rider: "Rider",
};

const demoRoles: DemoRole[] = ["admin", "merchant", "rider"];

export function DemoQuickLogin() {
  return (
    <Card className="w-full max-w-md border-[#3f3a52] bg-white text-foreground shadow-2xl">
      <CardHeader>
        <CardTitle>Try the demo</CardTitle>
        <p className="text-sm text-muted-foreground">
          One click signs you in. Demo data resets daily.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {demoRoles.map((role) => (
            <form key={role} method="post" action={`/demo/${role}`}>
              <Button className="w-full" type="submit" variant="secondary">
                {demoRoleLabels[role]}
              </Button>
            </form>
          ))}
        </div>
        <details className="text-sm text-muted-foreground">
          <summary className="cursor-pointer">Or sign in by hand</summary>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
            {demoRoles.map((role) => (
              <div key={role} className="contents">
                <dt>{demoRoleLabels[role]}</dt>
                <dd>{DEMO_ACCOUNTS[role].username}</dd>
              </div>
            ))}
            <dt>Password</dt>
            <dd>{DEMO_ACCOUNTS.admin.password}</dd>
          </dl>
        </details>
      </CardContent>
    </Card>
  );
}
