import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, PackageCheck } from "lucide-react";

import { DemoQuickLogin } from "@/features/auth/components/demo-quick-login";
import { LoginForm } from "@/features/auth/components/login-form";
import { isDemoMode } from "@/lib/demo";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  const demoMode = isDemoMode();

  return (
    <main className="flex min-h-svh items-center justify-center bg-primary px-6 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,#c9b4fa_0,transparent_25%),linear-gradient(135deg,#1b1938_0%,#0e0c1f_100%)] opacity-80" />
      <div className="relative grid w-full max-w-5xl gap-10 sm:justify-center lg:grid-cols-[1fr_420px] lg:items-center">
        <section className="text-primary-foreground">
          <Link href="/" className="mb-10 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-white text-primary">
              <PackageCheck className="size-5" />
            </div>
            <span className="text-sm font-semibold">Parcel Flow</span>
          </Link>
          <h1 className="max-w-lg text-5xl leading-[0.96] font-semibold tracking-normal">
            Manage today's parcel flow.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-7 text-[#bcbac9]">
            {demoMode
              ? "This is a public demo. Pick a role to look around, or sign in with the demo credentials."
              : "Use the credentials from your admin."}
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[#bcbac9] hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Back to home
          </Link>
        </section>
        <div className="flex flex-col gap-4">
          {demoMode ? <DemoQuickLogin /> : null}
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
