import Link from "next/link";
import { Button } from "@/components/ui/button";

type UserSummaryProps = {
  name: string;
  role: string;
};

export function UserSummary({ name, role }: UserSummaryProps) {
  return (
    <div className="space-y-3 rounded-lg border bg-card px-3 py-3 text-sm">
      <div>
        <p className="font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{role}</p>
      </div>
      <Button asChild variant="outline" size="sm" className="w-full">
        <Link href="/sign-in">Sign out</Link>
      </Button>
    </div>
  );
}
