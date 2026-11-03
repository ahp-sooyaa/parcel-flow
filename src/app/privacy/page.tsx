import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What the Parcel Flow web app and rider app collect, and why.",
};

// The Google Play listing links here. Replace before submitting the listing.
const CONTACT_EMAIL = "privacy@example.com";
const LAST_UPDATED = "2 November 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-[#292827]">
      <Link href="/" className="text-sm font-semibold text-[#1b1938]">
        Parcel Flow
      </Link>
      <h1 className="mt-6 text-4xl leading-tight font-semibold tracking-tight">Privacy policy</h1>
      <p className="mt-2 text-sm text-[#6b6866]">Last updated {LAST_UPDATED}</p>

      <Section title="Who this covers">
        <p>
          Parcel Flow is a parcel delivery management system with a web dashboard and an Android app
          for riders. Accounts are created by an admin of the delivery business; there is no public
          sign-up. This policy covers both the web dashboard and the rider app.
        </p>
      </Section>

      <Section title="What we collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Account details:</strong> name, username, phone number and role, entered by an
            admin, and a password you choose.
          </li>
          <li>
            <strong>Parcel and delivery data:</strong> recipient names, phone numbers and addresses,
            parcel status, cash on delivery amounts, and failure notes a rider writes.
          </li>
          <li>
            <strong>Delivery proof photos:</strong> photos a rider takes or picks from their gallery
            when marking a parcel delivered. The app uses the camera only when the rider chooses to
            take a photo.
          </li>
          <li>
            <strong>Technical data:</strong> sign-in sessions, and error reports with device and
            browser details, used to keep the service working.
          </li>
        </ul>
        <p>
          We do not collect your location, contacts or microphone audio, and we do not show ads or
          use advertising or analytics trackers.
        </p>
      </Section>

      <Section title="How we use it">
        <p>
          To run deliveries: assigning parcels to riders, recording delivery and payment, settling
          cash with merchants and riders, and resolving failed deliveries. Data is shared only with
          the people in the delivery business who need it for those tasks, and with the service
          providers that host the system (database, file storage and error monitoring). We do not
          sell it.
        </p>
      </Section>

      <Section title="Security and retention">
        <p>
          Data travels over HTTPS. The rider app keeps its session in the device&apos;s secure
          storage and removes it on sign-out. Parcel records and proof photos are kept as long as
          the delivery business needs them for its records; an admin can deactivate accounts.
        </p>
      </Section>

      <Section title="Your choices">
        <p>
          To see, correct or delete your data, ask the admin of the delivery business you work with,
          or contact us at{" "}
          <a className="font-medium text-[#1b1938] underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10 space-y-3 text-base leading-7">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}
