import Link from "next/link";
import { Button } from "@/components/ui/button";

type ResetRequiredBannerProps = {
    enabled: boolean;
};

export function ResetRequiredBanner({ enabled }: ResetRequiredBannerProps) {
    if (!enabled) {
        return null;
    }

    return (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
                <p className="text-sm font-semibold">Password Change Required</p>
                <p className="text-xs">
                    Your account is in limited-access mode until you change your password.
                </p>
            </div>
            <Button asChild size="sm" className="w-fit">
                <Link href="/dashboard/settings?tab=account-details">Change Password</Link>
            </Button>
        </div>
    );
}
