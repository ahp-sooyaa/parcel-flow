import { notFound } from "next/navigation";
import { getDeliveryPricingAccess } from "@/features/auth/server/policies/delivery-pricing";
import { requireAppAccessContext } from "@/features/auth/server/utils";
import { CreateDeliveryPricingRateForm } from "@/features/delivery-pricing/components/create-delivery-pricing-rate-form";
import { DeactivateDeliveryPricingRateForm } from "@/features/delivery-pricing/components/deactivate-delivery-pricing-rate-form";
import { EditDeliveryPricingRateForm } from "@/features/delivery-pricing/components/edit-delivery-pricing-rate-form";
import {
    getDeliveryPricingFormOptions,
    getDeliveryPricingRatesForViewer,
} from "@/features/delivery-pricing/server/dal";

export default async function DeliveryPricingPage() {
    const currentUser = await requireAppAccessContext();
    const access = getDeliveryPricingAccess(currentUser);

    if (!access.canView) {
        notFound();
    }

    const [rates, options] = await Promise.all([
        getDeliveryPricingRatesForViewer(currentUser),
        getDeliveryPricingFormOptions(),
    ]);

    return (
        <section className="space-y-6">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">Delivery Pricing</h1>
                <p className="text-sm text-muted-foreground">
                    Configure township delivery fees and merchant-specific pricing overrides used by
                    parcel creation.
                </p>
            </header>

            {access.canCreate ? (
                <CreateDeliveryPricingRateForm
                    merchants={options.merchants}
                    townships={options.townships}
                />
            ) : null}

            <div className="space-y-4">
                {rates.map((rate) => (
                    <article key={rate.id} className="rounded-xl border bg-card p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-lg font-semibold">{rate.townshipName}</h2>
                                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                        {rate.scope === "global" ? "Global" : "Merchant Contract"}
                                    </span>
                                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                        {rate.isActive ? "Active" : "Inactive"}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {rate.merchantLabel ??
                                        "Applies to all merchants in this township."}
                                </p>
                                <div className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
                                    <p>
                                        Base: {rate.baseWeightKg} kg / {rate.baseFee} Ks
                                    </p>
                                    <p>
                                        Extra: {rate.extraWeightUnitKg} kg / {rate.extraWeightFee}{" "}
                                        Ks
                                    </p>
                                    <p>Volumetric Divisor: {rate.volumetricDivisor}</p>
                                    <p>
                                        COD {rate.codFeePercent} · Return {rate.returnFeePercent}
                                    </p>
                                </div>
                            </div>

                            {access.canUpdate ? (
                                <div className="min-w-40">
                                    <DeactivateDeliveryPricingRateForm
                                        rateId={rate.id}
                                        disabled={!rate.isActive}
                                    />
                                </div>
                            ) : null}
                        </div>

                        {access.canUpdate ? (
                            <div className="mt-4">
                                <EditDeliveryPricingRateForm
                                    rate={rate}
                                    merchants={options.merchants}
                                    townships={options.townships}
                                />
                            </div>
                        ) : null}
                    </article>
                ))}

                {rates.length === 0 ? (
                    <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
                        No delivery pricing rates found.
                    </div>
                ) : null}
            </div>
        </section>
    );
}
