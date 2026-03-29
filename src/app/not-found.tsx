import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h2 className="text-2xl font-semibold tracking-tight">Page Not Found</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        We could not find this dashboard page. Return to the main dashboard and try again.
      </p>
      <Button asChild>
        <Link href="/dashboard">Back To Dashboard</Link>
      </Button>
    </div>
  );
}
