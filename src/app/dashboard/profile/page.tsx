import { redirect } from "next/navigation";

type LegacyProfilePageProps = {
    searchParams: Promise<{ tab?: string }>;
};

export default async function LegacyProfilePage({
    searchParams,
}: Readonly<LegacyProfilePageProps>) {
    const { tab } = await searchParams;
    const query = new URLSearchParams();

    if (tab) {
        query.set("tab", tab);
    }

    redirect(`/dashboard/settings${query.size ? `?${query.toString()}` : ""}`);
}
