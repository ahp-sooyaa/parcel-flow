import { SignInForm } from "@/features/auth/components/sign-in-form";

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
        <SignInForm />
      </section>
    </div>
  );
}
