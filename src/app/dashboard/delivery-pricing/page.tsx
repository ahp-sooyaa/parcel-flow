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
            <header className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Delivery Pricing</h1>
                    <p className="text-sm text-muted-foreground">
                        Configure township delivery fees and merchant-specific pricing overrides
                        used by parcel creation.
                    </p>
                </div>

                {access.canCreate ? (
                    <CreateDeliveryPricingRateForm
                        merchants={options.merchants}
                        townships={options.townships}
                    />
                ) : null}
            </header>

            <div className="rounded-xl border bg-card">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/40 text-xs uppercase">
                            <tr>
                                <th className="px-4 py-3">Township</th>
                                <th className="px-4 py-3">Scope</th>
                                <th className="px-4 py-3">Merchant</th>
                                <th className="px-4 py-3">Base</th>
                                <th className="px-4 py-3">Extra</th>
                                <th className="px-4 py-3">Volumetric</th>
                                <th className="px-4 py-3">Fees</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rates.map((rate) => (
                                <tr key={rate.id} className="border-t align-top">
                                    <td className="px-4 py-3 font-medium">{rate.townshipName}</td>
                                    <td className="px-4 py-3">
                                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                            {rate.scope === "global"
                                                ? "Global"
                                                : "Merchant Contract"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {rate.merchantLabel ?? "All merchants"}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div>{rate.baseWeightKg} kg</div>
                                        <div className="text-muted-foreground">
                                            {rate.baseFee} Ks
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div>{rate.extraWeightUnitKg} kg</div>
                                        <div className="text-muted-foreground">
                                            {rate.extraWeightFee} Ks
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">{rate.volumetricDivisor}</td>
                                    <td className="px-4 py-3">
                                        <div>COD {rate.codFeePercent}</div>
                                        <div className="text-muted-foreground">
                                            Return {rate.returnFeePercent}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                            {rate.isActive ? "Active" : "Inactive"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {access.canUpdate ? (
                                            <div className="flex flex-wrap gap-2">
                                                <EditDeliveryPricingRateForm
                                                    rate={rate}
                                                    merchants={options.merchants}
                                                    townships={options.townships}
                                                />
                                                <DeactivateDeliveryPricingRateForm
                                                    rateId={rate.id}
                                                    disabled={!rate.isActive}
                                                />
                                            </div>
                                        ) : (
                                            "-"
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {rates.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={9}
                                        className="px-4 py-10 text-center text-xs text-muted-foreground"
                                    >
                                        No delivery pricing rates found.
                                    </td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
