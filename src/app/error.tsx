"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

type DashboardErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardErrorPage({ error, reset }: DashboardErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-sm font-medium text-muted-foreground">Unexpected Error</p>
      <h2 className="text-2xl font-semibold tracking-tight">Something Went Wrong</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        An unexpected issue occurred while loading this dashboard screen.
      </p>
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
