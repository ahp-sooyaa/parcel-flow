import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-8">
      <section className="w-full max-w-md space-y-6 rounded-xl border bg-card p-6">
        <header className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Parcel Flow</p>
          <h1 className="text-2xl font-semibold tracking-tight">Sign In</h1>
          <p className="text-sm text-muted-foreground">
            Access your delivery operations dashboard.
          </p>
        </header>

        <form className="space-y-5">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="name@company.com" required />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="password">Password</Label>
              <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
                Need help?
              </Link>
            </div>
            <Input id="password" name="password" type="password" required />
          </div>

          <Button type="submit" className="w-full">
            Sign In
          </Button>
        </form>
      </section>
    </div>
  );
}
