import Link from "next/link";
import { ArrowLeft, PackageCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="min-h-svh bg-primary text-primary-foreground">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,#c9b4fa_0,transparent_24%),radial-gradient(circle_at_86%_54%,#6daedb_0,transparent_22%),linear-gradient(135deg,#1b1938_0%,#0e0c1f_100%)] opacity-90" />
        <div className="relative mx-auto flex min-h-[72svh] w-full max-w-6xl flex-col px-6 py-6">
          <header className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-white text-primary">
              <PackageCheck className="size-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Parcel Flow</div>
              <div className="text-xs text-[#bcbac9]">Office operations</div>
            </div>
          </header>

          <div className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[minmax(0,1fr)_380px] lg:py-20">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#c9b4fa]">
                Error 404
              </p>
              <h1 className="mt-5 max-w-2xl text-5xl font-semibold leading-[0.96] tracking-[-0.03em] sm:text-6xl">
                This route dropped out of the parcel flow.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#bcbac9]">
                The page you requested does not exist, may have moved, or is not available from this
                account context.
              </p>
              <Button
                asChild
                className="mt-8 rounded-full bg-[#c9b4fa] text-primary hover:bg-[#d7c5ff]"
              >
                <Link href="/">
                  Return home
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
            </div>

            <div className="rounded-[2rem] border border-[#3f3a52] bg-white/8 p-5 shadow-2xl backdrop-blur-sm">
              <div className="rounded-[1.5rem] border border-white/10 bg-[linear-gradient(160deg,rgba(250,250,248,0.18)_0%,rgba(201,180,250,0.24)_48%,rgba(14,48,48,0.4)_100%)] p-6">
                <div className="text-xs uppercase tracking-[0.16em] text-[#bcbac9]">Status</div>
                <div className="mt-3 text-4xl font-semibold leading-none tracking-[-0.04em]">
                  404
                </div>
                <div className="mt-6 space-y-3 text-sm text-[#bcbac9]">
                  <p>Check the address if you typed it manually.</p>
                  <p>Use the dashboard navigation if you expected an internal screen.</p>
                  <p>Sign in again if a protected route expired.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white text-[#292827]">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#73706d]">
              Next steps
            </p>
            <p className="mt-3 max-w-2xl text-xl font-semibold leading-tight tracking-[-0.02em]">
              Most missing pages are recoverable by returning to a known entry point and reopening
              the workflow from there.
            </p>
          </div>
          <div className="space-y-3 text-sm leading-7 text-[#73706d]">
            <p>
              Go back to the{" "}
              <Link href="/dashboard" className="font-semibold text-[#292827]">
                dashboard
              </Link>{" "}
              if you were working inside the admin area.
            </p>
            <p>
              Head to{" "}
              <Link href="/login" className="font-semibold text-[#292827]">
                sign in
              </Link>{" "}
              if your session may have changed.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[#0e3030] text-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-10">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">Support</p>
          <p className="mt-3 max-w-3xl text-2xl font-semibold leading-tight tracking-[-0.02em]">
            If this route should exist, report the broken link or missing screen so it can be
            restored.
          </p>
        </div>
      </section>
    </main>
  );
}
