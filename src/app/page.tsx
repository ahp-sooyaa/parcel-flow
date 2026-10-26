import type { ReactNode, SVGProps } from "react";
import Link from "next/link";
import { JetBrains_Mono } from "next/font/google";
import { ArrowRight, ArrowUpRight, Check, Clock } from "lucide-react";

import { isDemoMode, type DemoRole } from "@/lib/demo";
import { cn } from "@/lib/utils";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: "500",
  variable: "--font-home-mono",
});

const GITHUB_URL = "https://github.com/ahp-sooyaa/parcel-flow";
const PORTFOLIO_URL = "https://aunghtetpaing.netlify.app";
const ACCENT = "#c9b4fa";
const roleCtaClassName =
  "flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1b1938] text-[15px] font-semibold text-white transition-colors hover:bg-[#0e0c1f]";

type Pill = "office" | "way" | "done" | "post";

const pillClassNames: Record<Pill, string> = {
  office: "bg-[#efece6] text-[#45423f]",
  way: "bg-[#e1ebfa] text-[#1d4a87]",
  done: "bg-[#d9eee7] text-[#0c5444]",
  post: "bg-[#fbeed6] text-[#7a4800]",
};

const previewRows: { code: string; township: string; rider: string; status: string; pill: Pill }[] =
  [
    {
      code: "PF-483921-740268",
      township: "Sanchaung",
      rider: "Ko Zaw Min",
      status: "On The Way",
      pill: "way",
    },
    {
      code: "PF-105377-628410",
      township: "Kamayut",
      rider: "Ko Thiha",
      status: "Delivered",
      pill: "done",
    },
    {
      code: "PF-772045-319956",
      township: "Hlaing",
      rider: "Unassigned",
      status: "At Office",
      pill: "office",
    },
    {
      code: "PF-260813-904127",
      township: "Bahan",
      rider: "Ko Aung Kyaw",
      status: "Postpone",
      pill: "post",
    },
    {
      code: "PF-938460-152703",
      township: "Tamwe",
      rider: "Ko Htet Naing",
      status: "Delivered",
      pill: "done",
    },
  ];

const steps: {
  num: string;
  label: string;
  pill: Pill;
  title: string;
  body: string;
  who: string;
}[] = [
  {
    num: "01",
    label: "At Office",
    pill: "office",
    title: "Log it on arrival",
    body: "Pick the merchant, enter the receiver and township. The delivery fee fills in from township pricing, and a PF code is issued.",
    who: "Office admin",
  },
  {
    num: "02",
    label: "Assigned",
    pill: "office",
    title: "Assign a rider",
    body: "See each rider’s expected collection for the day before handing over more parcels.",
    who: "Office admin",
  },
  {
    num: "03",
    label: "On The Way",
    pill: "way",
    title: "Out for delivery",
    body: "Riders start delivery from their parcel cards and record the COD and fee they actually collect.",
    who: "Rider",
  },
  {
    num: "04",
    label: "Delivered",
    pill: "done",
    title: "Ready to settle",
    body: "Delivered parcels become financial items, eligible for the next merchant settlement and rider payout.",
    who: "Rider or admin",
  },
];

const roles: Array<{
  mark: string;
  demoRole: DemoRole;
  name: string;
  sub: string;
  cta: string;
  items: string[];
}> = [
  {
    mark: "A",
    demoRole: "admin",
    name: "Admins",
    sub: "Super admin & office admin",
    cta: "Try as Admin",
    items: [
      "Create, edit and assign parcels",
      "Review failure notes and decide retry or return",
      "Correct status or rider with a recorded reason",
      "Build settlements and rider payouts",
    ],
  },
  {
    mark: "M",
    demoRole: "merchant",
    name: "Merchants",
    sub: "Read-only view of their business",
    cta: "Try as Merchant",
    items: [
      "See every parcel the moment it’s logged",
      "Search by receiver phone, filter by date",
      "Follow settlement and payment status",
      "Browse paid settlement history",
    ],
  },
  {
    mark: "R",
    demoRole: "rider",
    name: "Riders",
    sub: "Assigned parcels only",
    cta: "Try as Rider",
    items: [
      "Parcel cards built for the road",
      "Start delivery and mark delivered",
      "Expected vs. actual collection at a glance",
      "Complete assigned merchant returns",
    ],
  },
];

const moneyPoints = [
  {
    num: "01",
    title: "COD & delivery fee tracking",
    body: "Collected, not collected, deducted from merchant or waived — each parcel carries its own fee and COD state.",
  },
  {
    num: "02",
    title: "Merchant settlements",
    body: "Bundle eligible financial items into a settlement. A super admin marks it paid with the bank transfer receipt.",
  },
  {
    num: "03",
    title: "Rider payouts",
    body: "Pay riders per payable delivery attempt and merchant-return way, drafted and confirmed in one place.",
  },
];

const settlementLines = [
  { code: "PF-105377-628410", kind: "COD − fee", amount: "42,000 MMK" },
  { code: "PF-938460-152703", kind: "COD − fee", amount: "27,500 MMK" },
  { code: "PF-611904-283355", kind: "Fee deducted", amount: "−3,000 MMK" },
];

const stack = [
  { name: "Next.js", role: "App Router" },
  { name: "React 19" },
  { name: "TypeScript" },
  { name: "Supabase", role: "Postgres + Realtime" },
  { name: "Drizzle ORM" },
  { name: "Better Auth" },
  { name: "Zod" },
  { name: "React Hook Form" },
  { name: "Tailwind CSS" },
  { name: "shadcn/ui" },
  { name: "Cloudflare R2", role: "images" },
  { name: "Railway", role: "hosting" },
  { name: "Bun" },
  { name: "Playwright", role: "e2e" },
  { name: "Sentry" },
];

const decisions = [
  {
    num: "01",
    title: "Status state machine",
    body: "Every parcel moves through defined statuses with allowed transitions per role. Manual corrections require a recorded reason.",
  },
  {
    num: "02",
    title: "Live updates",
    body: "Status changes appear on admin, merchant and rider screens without a refresh, scoped by row-level security.",
  },
  {
    num: "03",
    title: "Financial items as the source of truth",
    body: "Delivered parcels generate financial items; settlements and rider payouts are built from them, so nothing is entered twice.",
  },
  {
    num: "04",
    title: "Role-based access",
    body: "Three roles with scoped views and permissions, enforced on the server, not just hidden in the UI.",
  },
];

const extras = [
  {
    title: "Readable parcel codes",
    body: "PF-XXXXXX-XXXXXX codes, unique in the database, easy to read out over the phone.",
  },
  {
    title: "Township pricing",
    body: "Delivery fees come from township settings, so no one quotes from memory.",
  },
  {
    title: "Tested & benchmarked",
    body: "Unit, integration and Playwright end-to-end tests, plus query performance baselines.",
  },
];

function LogoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M16 16h6" />
      <path d="m19 13 3 3-3 3" />
      <path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14" />
      <path d="m7.5 4.27 9 5.15" />
      <path d="M3.29 7 12 12l8.71-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

function GithubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

function StatusPill({ pill, children }: { pill: Pill; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        pillClassNames[pill],
      )}
    >
      {children}
    </span>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 text-[13px] font-semibold tracking-[0.4px] text-[#5b4bb0] uppercase">
      {children}
    </p>
  );
}

function SectionHeading({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <h2
      className={cn(
        "text-[34px] leading-[1.04] font-semibold tracking-[-1px] sm:text-[44px] sm:leading-[1.02] sm:tracking-[-1.2px]",
        className,
      )}
    >
      {children}
    </h2>
  );
}

const monoText = "font-[family-name:var(--font-home-mono)] text-xs";

export default function HomePage() {
  const demoMode = isDemoMode();

  return (
    <main
      className={cn(
        mono.variable,
        "min-w-0 bg-white text-[#292827] [font-variation-settings:normal]",
      )}
    >
      {/* Hero */}
      <section id="top" className="bg-[#1b1938] px-6 pt-6 text-white">
        <div className="mx-auto max-w-[1200px]">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#3f3a52] pt-1 pb-5">
            <Link href="#top" className="flex min-h-11 items-center gap-3 text-white">
              <span className="flex size-9 items-center justify-center rounded-lg bg-white text-[#1b1938]">
                <LogoIcon className="size-5" />
              </span>
              <span className="text-base font-semibold tracking-[-0.2px]">Parcel Flow</span>
            </Link>
            <nav aria-label="Main" className="flex flex-wrap items-center gap-1">
              {[
                { href: "#flow", label: "How it works" },
                { href: "#demo", label: "Roles" },
                { href: "#money", label: "COD & payouts" },
                { href: "#built", label: "How it’s built" },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="hidden p-3 text-sm text-[#bcbac9] transition-colors hover:text-white md:inline-block"
                >
                  {item.label}
                </a>
              ))}
              <a
                href={GITHUB_URL}
                aria-label="Parcel Flow on GitHub"
                className="ml-1 inline-flex size-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
              >
                <GithubIcon className="size-5" />
              </a>
              <a
                href="#demo"
                className="ml-1 inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold text-[#1b1938] transition-opacity hover:opacity-90"
                style={{ background: ACCENT }}
              >
                Live demo
              </a>
            </nav>
          </header>

          <div className="flex flex-wrap items-center gap-14 pt-16 pb-24 sm:pt-[88px]">
            <div className="min-w-0 flex-[1_1_460px]">
              <p
                className="mb-5 inline-flex items-center gap-2 text-[13px] font-[540] tracking-[0.2px]"
                style={{ color: ACCENT }}
              >
                <span className="size-2 rounded-full" style={{ background: ACCENT }} />
                Parcel delivery management · Yangon
              </p>
              <h1 className="text-[44px] leading-none font-semibold tracking-[-1.2px] sm:text-[60px] sm:leading-[0.98] sm:tracking-[-1.6px]">
                From the office shelf to the final settlement.
              </h1>
              <p className="mt-6 max-w-[520px] text-lg leading-[1.55] text-[#bcbac9]">
                A full-stack app for a small courier: log parcels as they arrive, assign riders,
                track every kyat of COD and delivery fees, and turn delivered parcels into merchant
                settlements and rider payouts.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <a
                  href="#demo"
                  className="inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-semibold text-[#1b1938] transition-opacity hover:opacity-90"
                  style={{ background: ACCENT }}
                >
                  Try live demo
                  <ArrowRight className="size-4" strokeWidth={2.2} />
                </a>
                <a
                  href={GITHUB_URL}
                  className="inline-flex h-12 items-center gap-2 rounded-full border border-[#3f3a52] px-6 text-[15px] font-[540] text-white transition-colors hover:bg-white/5"
                >
                  <GithubIcon className="size-4" />
                  View on GitHub
                </a>
              </div>
              <p className="mt-6 text-[13px] text-[#9e9bb3]">
                Portfolio project · Demo data resets daily
              </p>
            </div>

            {/* Product preview */}
            <div className="flex min-w-0 flex-[1_1_520px] items-end self-stretch">
              <div className="-mb-24 w-full rounded-t-2xl border border-b-0 border-[#3f3a52] bg-white px-5 pt-5 text-[#292827] shadow-[0_30px_60px_rgba(14,12,31,0.35)]">
                <div className="flex items-center justify-between gap-3 border-b border-[#e8e4dd] pb-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-semibold">Parcels</span>
                    <span className="text-xs text-[#73706d]">Today · all townships</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-[540] text-[#0e5a4a]">
                    <span className="size-[7px] rounded-full bg-[#1a8a6e]" />
                    Live
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5 py-4">
                  {[
                    { label: "At office", value: "38" },
                    { label: "On the way", value: "24" },
                    { label: "COD pending", value: "1,284,000", unit: "MMK" },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="min-w-0 rounded-[10px] border border-[#e8e4dd] bg-[#fafaf8] p-3"
                    >
                      <div className="text-xs text-[#73706d]">{stat.label}</div>
                      <div className="mt-1 text-lg font-semibold tracking-[-0.4px] sm:text-[22px]">
                        {stat.value}{" "}
                        {stat.unit ? (
                          <span className="text-xs font-[540] tracking-normal text-[#73706d]">
                            {stat.unit}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <div className="min-w-[460px]">
                    <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-3 px-1 py-2 text-[11px] font-[540] tracking-[0.6px] text-[#73706d] uppercase">
                      <span>Parcel</span>
                      <span>Township</span>
                      <span>Rider</span>
                      <span>Status</span>
                    </div>
                    {previewRows.map((row) => (
                      <div
                        key={row.code}
                        className="grid grid-cols-[1.5fr_1fr_1fr_1fr] items-center gap-3 border-t border-[#efece6] px-1 py-3 text-[13px]"
                      >
                        <span className={monoText}>{row.code}</span>
                        <span className="text-[#4a4744]">{row.township}</span>
                        <span className="text-[#4a4744]">{row.rider}</span>
                        <span>
                          <StatusPill pill={row.pill}>{row.status}</StatusPill>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Background */}
      <section id="background" className="bg-white px-6 pt-[168px]">
        <div className="mx-auto flex max-w-[1200px] flex-wrap gap-x-14 gap-y-6 border-b border-[#e8e4dd] pb-[72px]">
          <p className="flex-[0_1_220px] pt-1.5 text-[13px] font-semibold tracking-[0.4px] text-[#5b4bb0] uppercase">
            Background
          </p>
          <p className="max-w-[820px] min-w-0 flex-[1_1_560px] text-lg leading-normal font-[460] tracking-[-0.2px] text-[#292827] sm:text-[22px]">
            Parcel Flow was designed for a delivery business my sister was planning to start in
            Yangon. I modeled it on how small local couriers work: pickup arranged on Telegram, cash
            on delivery, township-based fees, and weekly settlements with merchants.{" "}
            <span className="text-[#73706d]">
              The business plans changed, so it’s now a source-available portfolio project.
            </span>
          </p>
        </div>
      </section>

      {/* Lifecycle */}
      <section id="flow" className="bg-white px-6 pt-[88px] pb-[104px]">
        <div className="mx-auto max-w-[1200px]">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="min-w-0 flex-[1_1_520px]">
              <Eyebrow>How it works</Eyebrow>
              <SectionHeading>One status trail for every parcel.</SectionHeading>
            </div>
            <p className="max-w-[440px] min-w-0 flex-[1_1_360px] text-base leading-relaxed text-[#73706d]">
              Pickup happens on Telegram, outside the app. Parcel Flow takes over the moment a
              parcel reaches the office, and records every change after that.
            </p>
          </div>

          <div className="mt-14 flex flex-wrap gap-3">
            {steps.map((step) => (
              <div
                key={step.num}
                className="flex min-w-0 flex-[1_1_220px] flex-col gap-3.5 rounded-[14px] border border-[#e8e4dd] bg-white p-6"
              >
                <div className="flex items-center justify-between">
                  <span className={cn(monoText, "text-[#73706d]")}>{step.num}</span>
                  <StatusPill pill={step.pill}>{step.label}</StatusPill>
                </div>
                <h3 className="text-[19px] font-semibold tracking-[-0.3px]">{step.title}</h3>
                <p className="text-sm leading-[1.55] text-[#73706d]">{step.body}</p>
                <span className="mt-auto text-xs font-[540] text-[#4a4744]">{step.who}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-3">
            <div className="flex min-w-0 flex-[1_1_420px] flex-wrap items-center gap-3.5 rounded-[14px] border border-[#e8e4dd] bg-[#fafaf8] px-6 py-5">
              <StatusPill pill="post">Postpone</StatusPill>
              <p className="flex-[1_1_240px] text-sm leading-normal text-[#4a4744]">
                Delivery failed? The rider leaves a note, an admin reviews it and schedules a retry
                — the parcel goes back to{" "}
                <strong className="font-semibold text-[#292827]">At Office</strong>.
              </p>
            </div>
            <div className="flex min-w-0 flex-[1_1_420px] flex-wrap items-center gap-3.5 rounded-[14px] border border-[#e8e4dd] bg-[#fafaf8] px-6 py-5">
              <span className="inline-block rounded-full bg-[#f8e1dc] px-2.5 py-1 text-xs font-semibold text-[#8f2f12]">
                Canceled
              </span>
              <p className="flex-[1_1_240px] text-sm leading-normal text-[#4a4744]">
                Won’t be retried? It’s routed for return handling until it is{" "}
                <strong className="font-semibold text-[#292827]">Returned to Merchant</strong>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Roles / demo */}
      <section
        id="demo"
        className="border-y border-[#e8e4dd] bg-[#fafaf8] px-6 py-20 sm:py-[104px]"
      >
        <div className="mx-auto max-w-[1200px]">
          <Eyebrow>Live demo</Eyebrow>
          <SectionHeading className="max-w-[720px]">
            Each role sees exactly what it needs.
          </SectionHeading>
          <p className="mt-5 text-base leading-relaxed text-[#73706d]">
            Pick a role — each one sees a different app. One click signs you in to a pre-seeded demo
            account.
          </p>

          <div className="mt-12 flex flex-wrap gap-4">
            {roles.map((role) => (
              <article
                key={role.name}
                className="flex min-w-0 flex-[1_1_320px] flex-col gap-5 rounded-2xl border border-[#e8e4dd] bg-white p-8"
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-11 items-center justify-center rounded-xl bg-[#1b1938] text-[15px] font-semibold text-white"
                  >
                    {role.mark}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <h3 className="text-xl font-semibold tracking-[-0.3px]">{role.name}</h3>
                    <span className="text-[13px] text-[#73706d]">{role.sub}</span>
                  </div>
                </div>
                <ul className="flex flex-col gap-3">
                  {role.items.map((item) => (
                    <li key={item} className="flex gap-2.5 text-sm leading-normal text-[#4a4744]">
                      <Check
                        aria-hidden="true"
                        className="mt-px size-[18px] flex-none text-[#155555]"
                        strokeWidth={2.2}
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                {demoMode ? (
                  <form method="post" action={`/demo/${role.demoRole}`} className="mt-auto">
                    <button type="submit" className={roleCtaClassName}>
                      {role.cta}
                      <ArrowRight className="size-4" strokeWidth={2.2} />
                    </button>
                  </form>
                ) : (
                  <Link href="/login" className={cn(roleCtaClassName, "mt-auto")}>
                    {role.cta}
                    <ArrowRight className="size-4" strokeWidth={2.2} />
                  </Link>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Money */}
      <section id="money" className="bg-white px-6 py-20 sm:py-[104px]">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-14">
          <div className="min-w-0 flex-[1_1_440px]">
            <Eyebrow>COD &amp; payouts</Eyebrow>
            <SectionHeading>Cash that adds up, down to the last kyat.</SectionHeading>
            <p className="mt-5 text-base leading-relaxed text-[#73706d]">
              Every delivered parcel produces financial items. Settlements and payouts are built
              from them — nothing typed in twice.
            </p>
            <div className="mt-9 flex flex-col border-t border-[#e8e4dd]">
              {moneyPoints.map((point) => (
                <div key={point.num} className="flex gap-4 border-b border-[#e8e4dd] py-5">
                  <span className={cn(monoText, "flex-none pt-[3px] text-[#5b4bb0]")}>
                    {point.num}
                  </span>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-[17px] font-semibold tracking-[-0.2px]">{point.title}</h3>
                    <p className="text-sm leading-[1.55] text-[#73706d]">{point.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Settlement mock */}
          <div className="min-w-0 flex-[1_1_440px]">
            <div className="rounded-[20px] bg-[#1b1938] p-5 text-white sm:p-7">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-[#bcbac9]">Merchant settlement</span>
                  <span className="text-lg font-semibold">Shwe Pyi Fashion</span>
                </div>
                <StatusPill pill="post">Pending</StatusPill>
              </div>
              <div className="mt-6 rounded-xl bg-white px-4 py-1 text-[#292827]">
                {settlementLines.map((line) => (
                  <div
                    key={line.code}
                    className="grid grid-cols-[1.4fr_1fr_1fr] gap-3 border-b border-[#efece6] py-3 text-[13px]"
                  >
                    <span className={cn(monoText, "truncate")}>{line.code}</span>
                    <span className="text-[#73706d]">{line.kind}</span>
                    <span className="text-right font-[540] whitespace-nowrap">{line.amount}</span>
                  </div>
                ))}
                <div className="flex justify-between py-3.5 text-sm font-semibold">
                  <span>Net to merchant</span>
                  <span>66,500 MMK</span>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-2.5">
                <span className="text-[13px] text-[#bcbac9]">
                  Super admin confirms with a bank transfer receipt.
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[#5a5772] px-3 py-1.5 text-xs font-[540] text-[#bcbac9]">
                  <Clock aria-hidden="true" className="size-3.5" />
                  Awaiting payment
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it's built */}
      <section
        id="built"
        className="border-t border-[#e8e4dd] bg-[#fafaf8] px-6 py-20 sm:py-[104px]"
      >
        <div className="mx-auto max-w-[1200px]">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="min-w-0 flex-[1_1_520px]">
              <Eyebrow>How it’s built</Eyebrow>
              <SectionHeading>Type-safe from the database to the form.</SectionHeading>
            </div>
            <a
              href={GITHUB_URL}
              className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-[#1b1938] underline underline-offset-4 hover:text-[#0e0c1f]"
            >
              Read the source on GitHub
              <ArrowUpRight className="size-4" strokeWidth={2.2} />
            </a>
          </div>

          <ul aria-label="Tech stack" className="mt-10 flex flex-wrap gap-2">
            {stack.map((tech) => (
              <li
                key={tech.name}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#e8e4dd] bg-white px-3.5 py-2 text-[13px] font-[540] text-[#292827]"
              >
                {tech.name}
                {tech.role ? <span className="font-normal text-[#73706d]">{tech.role}</span> : null}
              </li>
            ))}
          </ul>

          <div className="mt-10 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
            {decisions.map((decision) => (
              <article
                key={decision.num}
                className="flex flex-col gap-2.5 rounded-2xl border border-[#e8e4dd] bg-white p-7"
              >
                <span className={cn(monoText, "text-[#5b4bb0]")}>{decision.num}</span>
                <h3 className="text-lg font-semibold tracking-[-0.2px]">{decision.title}</h3>
                <p className="text-sm leading-[1.55] text-[#73706d]">{decision.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] border-t border-[#e8e4dd]">
            {extras.map((extra) => (
              <div key={extra.title} className="flex flex-col gap-1 pt-5 pr-6">
                <h3 className="text-[15px] font-semibold">{extra.title}</h3>
                <p className="text-sm leading-[1.55] text-[#73706d]">{extra.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-white px-6 py-16">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-8 rounded-3xl bg-[#0e3030] px-6 py-14 text-white sm:px-12 sm:py-[72px]">
          <div className="min-w-0 flex-[1_1_420px]">
            <h2 className="text-[32px] leading-[1.04] font-semibold tracking-[-1px] sm:text-[40px]">
              See it working.
            </h2>
            <p className="mt-3.5 text-base leading-[1.55] text-[#b7d0cc]">
              Try the live demo — no sign-up needed. Sample data resets every day.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href="#demo"
              className="inline-flex h-[52px] items-center gap-2 rounded-full bg-white px-7 text-[15px] font-semibold text-[#0e3030] transition-opacity hover:opacity-90"
            >
              Try live demo
              <ArrowRight className="size-4" strokeWidth={2.2} />
            </a>
            <a
              href={GITHUB_URL}
              className="inline-flex h-[52px] items-center rounded-full border border-[#2f5c5c] px-7 text-[15px] font-[540] text-white transition-colors hover:bg-white/5"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#e8e4dd] bg-white px-6 pt-8 pb-12">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 text-[13px] text-[#73706d]">
          <span>
            <strong className="font-semibold text-[#292827]">Parcel Flow</strong> · Built by Aung
            Htet Paing
          </span>
          <nav aria-label="Footer" className="flex flex-wrap gap-1">
            <a
              href={GITHUB_URL}
              className="inline-flex min-h-11 items-center px-3 font-[540] text-[#4a4744] hover:text-[#292827]"
            >
              GitHub
            </a>
            <a
              href={PORTFOLIO_URL}
              className="inline-flex min-h-11 items-center px-3 font-[540] text-[#4a4744] hover:text-[#292827]"
            >
              Portfolio
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
