import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-sm font-medium text-muted-foreground">403</p>
      <h1 className="text-2xl font-semibold tracking-tight">Access Denied</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        You do not have permission to access this page. Please contact an administrator if you think
        this is an error.
      </p>
      <Button asChild>
        <Link href="/dashboard">Back To Dashboard</Link>
      </Button>
    </div>
  );
}
