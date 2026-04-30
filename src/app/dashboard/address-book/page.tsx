import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PickupLocationsPanel } from "@/features/address-book/components/pickup-locations-panel";
import { RecipientContactsPanel } from "@/features/address-book/components/recipient-contacts-panel";
import { getAddressBookPageData } from "@/features/address-book/server/dal";
import {
    normalizeAddressBookQuery,
    normalizeAddressBookTab,
} from "@/features/address-book/server/utils";
import { getAddressBookAccess } from "@/features/auth/server/policies/address-book";
import { requirePermission } from "@/features/auth/server/utils";
import { buildDashboardHref } from "@/lib/dashboard-navigation";
import { cn } from "@/lib/utils";

type AddressBookPageProps = {
    searchParams: Promise<{
        merchantId?: string | string[];
        q?: string | string[];
        tab?: string | string[];
    }>;
};

function getSearchParamValue(raw: string | string[] | undefined) {
    return Array.isArray(raw) ? raw[0] : raw;
}

export default async function AddressBookPage({ searchParams }: Readonly<AddressBookPageProps>) {
    const currentUser = await requirePermission("address-book.view");
    const access = getAddressBookAccess({ viewer: currentUser });

    if (!access.canView) {
        notFound();
    }

    const rawSearchParams = await searchParams;
    const requestedMerchantId = getSearchParamValue(rawSearchParams.merchantId);
    const query = normalizeAddressBookQuery(getSearchParamValue(rawSearchParams.q));
    const activeTab = normalizeAddressBookTab(getSearchParamValue(rawSearchParams.tab));
    const pageData = await getAddressBookPageData(currentUser, {
        merchantId: requestedMerchantId,
        query,
    });

    const baseQuery = {
        merchantId: pageData.selectedMerchantId ?? undefined,
        q: query || undefined,
    };
    const recipientContactsHref = buildDashboardHref("/dashboard/address-book", {
        ...baseQuery,
        tab: "recipient-contacts",
    });
    const pickupLocationsHref = buildDashboardHref("/dashboard/address-book", {
        ...baseQuery,
        tab: "pickup-locations",
    });

    return (
        <section className="space-y-6">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">Address Book</h1>
                <p className="text-sm text-muted-foreground">
                    Manage merchant recipient contacts and pickup locations used by parcel
                    workflows.
                </p>
            </header>

            {access.canSelectMerchant ? (
                <form method="get" className="rounded-xl border bg-card p-4">
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="grid min-w-[260px] gap-2">
                            <label htmlFor="merchantId" className="text-sm font-medium">
                                Merchant
                            </label>
                            <select
                                id="merchantId"
                                name="merchantId"
                                defaultValue={pageData.selectedMerchantId ?? ""}
                                className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                                <option value="">Select merchant</option>
                                {pageData.merchants.map((merchant) => (
                                    <option key={merchant.id} value={merchant.id}>
                                        {merchant.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {activeTab === "recipient-contacts" ? (
                            <div className="grid min-w-[260px] gap-2">
                                <label htmlFor="q" className="text-sm font-medium">
                                    Search Contacts
                                </label>
                                <input
                                    id="q"
                                    name="q"
                                    defaultValue={query}
                                    placeholder="Search label, recipient, phone, township, or address"
                                    className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                />
                            </div>
                        ) : null}

                        <input type="hidden" name="tab" value={activeTab} />
                        <Button type="submit" variant="outline">
                            Apply
                        </Button>
                    </div>
                </form>
            ) : null}

            {!pageData.selectedMerchantId ? (
                <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
                    Select a merchant to manage recipient contacts and pickup locations.
                </div>
            ) : (
                <>
                    <nav
                        className="flex items-center gap-1 overflow-x-auto border-b"
                        aria-label="Address book tabs"
                    >
                        <Link
                            href={recipientContactsHref}
                            className={cn(
                                "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                                {
                                    "border-primary text-foreground":
                                        activeTab === "recipient-contacts",
                                    "border-transparent text-muted-foreground hover:text-foreground":
                                        activeTab !== "recipient-contacts",
                                },
                            )}
                        >
                            Recipient Contacts
                        </Link>
                        <Link
                            href={pickupLocationsHref}
                            className={cn(
                                "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                                {
                                    "border-primary text-foreground":
                                        activeTab === "pickup-locations",
                                    "border-transparent text-muted-foreground hover:text-foreground":
                                        activeTab !== "pickup-locations",
                                },
                            )}
                        >
                            Pickup Locations
                        </Link>
                    </nav>

                    {activeTab === "recipient-contacts" ? (
                        <RecipientContactsPanel
                            merchantId={pageData.selectedMerchantId}
                            contacts={pageData.recipientContacts}
                            townships={pageData.townships}
                        />
                    ) : (
                        <PickupLocationsPanel
                            merchantId={pageData.selectedMerchantId}
                            pickupLocations={pageData.pickupLocations}
                            townships={pageData.townships}
                        />
                    )}
                </>
            )}
        </section>
    );
}
