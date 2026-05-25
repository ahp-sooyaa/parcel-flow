import Link from "next/link";
import { ArrowRight, PackageCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-svh bg-primary text-primary-foreground">
      <section className="relative flex min-h-svh overflow-hidden px-6 py-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_22%,#c9b4fa_0,transparent_28%),radial-gradient(circle_at_86%_58%,#6daedb_0,transparent_24%),linear-gradient(135deg,#1b1938_0%,#0e0c1f_100%)] opacity-80" />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-md bg-white text-primary">
                <PackageCheck className="size-5" />
              </div>
              <span className="text-sm font-semibold">Parcel Flow</span>
            </div>
            <Button asChild className="rounded-full bg-[#c9b4fa] text-primary hover:bg-[#d7c5ff]">
              <Link href="/login">Sign in</Link>
            </Button>
          </header>

          <div className="grid flex-1 items-center gap-12 py-20 lg:grid-cols-[1fr_420px]">
            <div className="max-w-3xl">
              <h1 className="text-5xl leading-[0.96] font-semibold tracking-normal sm:text-6xl">
                Manage parcel operations.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-7 text-[#bcbac9]">
                Create parcels, assign riders, track COD, and generate merchant settlements.
              </p>
              <Button
                asChild
                className="mt-8 rounded-full bg-[#c9b4fa] text-primary hover:bg-[#d7c5ff]"
              >
                <Link href="/dashboard">
                  Open dashboard
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
            <div className="hidden min-h-[520px] rounded-l-[96px] border border-[#3f3a52] bg-white/10 p-6 shadow-2xl lg:block">
              <div className="h-full rounded-l-[72px] bg-[linear-gradient(160deg,#fafaf8_0%,#c9b4fa_52%,#155555_100%)] opacity-90" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
