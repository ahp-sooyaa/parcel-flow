import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";

import "@/app/globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const description =
  "Parcel delivery management for a small Yangon courier: parcel intake, rider assignment, COD tracking, merchant settlements and rider payouts. Try the live demo as an admin, merchant or rider.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Parcel Flow · Parcel delivery management",
    template: "%s · Parcel Flow",
  },
  description,
  openGraph: {
    type: "website",
    siteName: "Parcel Flow",
    title: "Parcel Flow · Parcel delivery management",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "Parcel Flow · Parcel delivery management",
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
