"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

type DashboardErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardErrorPage({ error, reset }: Readonly<DashboardErrorPageProps>) {
  const isAccessError =
    error.message === "Unauthorized" ||
    error.message === "Forbidden" ||
    error.message === "Password reset required before this action is allowed";

  const title = isAccessError ? "Access Restricted" : "Something Went Wrong";
  const description = isAccessError
    ? "You do not have access to perform this action. If this seems wrong, contact an administrator."
    : "An unexpected issue occurred while loading this dashboard screen.";

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-sm font-medium text-muted-foreground">
        {isAccessError ? "Authorization Error" : "Unexpected Error"}
      </p>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button type="button" onClick={reset}>
          Try Again
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard">Back To Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
