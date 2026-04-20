import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/server/actions";

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
                <Link href="/dashboard/profile">My Profile</Link>
            </Button>
            <form action={signOutAction}>
                <Button type="submit" variant="secondary" size="sm" className="w-full">
                    Sign out
                </Button>
            </form>
        </div>
    );
}
