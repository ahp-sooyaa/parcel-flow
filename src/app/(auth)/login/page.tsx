import Link from "next/link";
import { PackageCheck } from "lucide-react";

import { LoginForm } from "@/features/auth/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-primary px-6 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,#c9b4fa_0,transparent_25%),linear-gradient(135deg,#1b1938_0%,#0e0c1f_100%)] opacity-80" />
      <div className="relative grid w-full max-w-5xl gap-10 lg:grid-cols-[1fr_420px] lg:items-center">
        <section className="text-primary-foreground">
          <Link href="/" className="mb-10 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-white text-primary">
              <PackageCheck className="size-5" />
            </div>
            <span className="text-sm font-semibold">Parcel Flow</span>
          </Link>
          <h1 className="max-w-xl text-5xl font-semibold leading-[0.96] tracking-normal">
            Sign in to manage today&apos;s parcel flow.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-7 text-[#bcbac9]">
            Accounts are created by admins only. There is no public signup or OTP flow in the MVP.
          </p>
        </section>
        <LoginForm />
      </div>
    </main>
  );
}
