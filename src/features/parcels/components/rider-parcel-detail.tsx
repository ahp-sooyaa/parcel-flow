"use client";

import { useActionState } from "react";
import { FormFieldError } from "@/components/shared/form-field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ParcelImageList } from "@/features/parcels/components/parcel-image-list";
import { formatParcelStatusLabel } from "@/features/parcels/constants";
import {
    advanceRiderParcelAction,
    uploadRiderParcelImagesAction,
} from "@/features/parcels/server/actions";
import { cn } from "@/lib/utils";

import type {
    RiderParcelDetailDto,
    RiderParcelImageUploadActionResult,
} from "@/features/parcels/server/dto";

type RiderParcelDetailProps = {
    parcel: RiderParcelDetailDto;
};

const initialUploadState: RiderParcelImageUploadActionResult = {
    ok: true,
    message: "",
    fields: undefined,
    fieldErrors: undefined,
};

export function RiderParcelDetail({ parcel }: Readonly<RiderParcelDetailProps>) {
    const [uploadState, uploadAction, isUploadPending] = useActionState(
        uploadRiderParcelImagesAction,
        initialUploadState,
    );
    const getFieldError = (fieldName: string) => uploadState.fieldErrors?.[fieldName]?.[0];

    return (
        <section className="mx-auto w-full max-w-3xl space-y-6">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">{parcel.parcelCode}</h1>
                <p className="text-sm text-muted-foreground">
                    Rider parcel detail with the next allowed workflow step.
                </p>
            </header>

            {parcel.nextAction ? (
                <form action={advanceRiderParcelAction}>
                    <input type="hidden" name="parcelId" value={parcel.id} />
                    <input type="hidden" name="nextStatus" value={parcel.nextAction.nextStatus} />
                    <Button type="submit">{parcel.nextAction.label}</Button>
                </form>
            ) : (
                <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                    No rider action is available for the current parcel status.
                </p>
            )}

            <div className="grid gap-4 rounded-xl border bg-card p-5 text-sm">
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Merchant</p>
                    <p>{parcel.merchantLabel}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Assigned Rider</p>
                    <p>{parcel.riderLabel ?? "-"}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Recipient</p>
                    <p>
                        {parcel.recipientName} ({parcel.recipientPhone})
                    </p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Recipient Township</p>
                    <p>{parcel.recipientTownshipName ?? "-"}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Recipient Address</p>
                    <p>{parcel.recipientAddress}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Parcel Description</p>
                    <p>{parcel.parcelDescription}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Package Count</p>
                    <p>{parcel.packageCount}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Special Handling Note</p>
                    <p>{parcel.specialHandlingNote ?? "-"}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Estimated Weight</p>
                    <p>{parcel.estimatedWeightKg ? `${parcel.estimatedWeightKg} kg` : "-"}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Dimensions</p>
                    <p>
                        {parcel.packageWidthCm && parcel.packageHeightCm && parcel.packageLengthCm
                            ? `${parcel.packageWidthCm} x ${parcel.packageHeightCm} x ${parcel.packageLengthCm} cm`
                            : "-"}
                    </p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Parcel Type</p>
                    <p>{parcel.parcelType}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Parcel Status</p>
                    <p>{parcel.parcelStatus}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">COD Amount</p>
                    <p>{parcel.codAmount}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Amount To Collect</p>
                    <p>{parcel.totalAmountToCollect}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Delivery Fee Plan</p>
                    <p>
                        {parcel.deliveryFeePaymentPlan
                            ? formatParcelStatusLabel(parcel.deliveryFeePaymentPlan)
                            : "Not recorded"}
                    </p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Collection Status</p>
                    <p>{parcel.collectionStatus}</p>
                </div>
            </div>

            <div className="space-y-4 rounded-xl border bg-card p-5">
                <ParcelImageList title="Pickup Images" images={parcel.pickupImages} />
                <ParcelImageList
                    title="Proof Of Delivery Images"
                    images={parcel.proofOfDeliveryImages}
                />
            </div>

            <form action={uploadAction} className="space-y-4 rounded-xl border bg-card p-5">
                <input type="hidden" name="parcelId" value={parcel.id} />

                <div className="space-y-1">
                    <h2 className="text-sm font-semibold">Upload Parcel Images</h2>
                    <p className="text-xs text-muted-foreground">
                        Riders can upload pickup and proof of delivery images here.
                    </p>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="rider-pickup-images">Pickup Images</Label>
                    <Input
                        id="rider-pickup-images"
                        name="pickupImages"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                    />
                    <FormFieldError message={getFieldError("pickupImages")} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="rider-proof-images">Proof Of Delivery Images</Label>
                    <Input
                        id="rider-proof-images"
                        name="proofOfDeliveryImages"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                    />
                    <FormFieldError message={getFieldError("proofOfDeliveryImages")} />
                </div>

                {uploadState.message && (
                    <div
                        className={cn("rounded-lg border p-3", {
                            "border-emerald-300 bg-emerald-50": uploadState.ok,
                            "border-red-300 bg-red-50": !uploadState.ok,
                        })}
                    >
                        <p
                            className={cn("text-xs", {
                                "text-emerald-800": uploadState.ok,
                                "text-destructive": !uploadState.ok,
                            })}
                        >
                            {uploadState.message}
                        </p>
                    </div>
                )}

                <Button type="submit" disabled={isUploadPending}>
                    {isUploadPending ? "Uploading..." : "Upload Images"}
                </Button>
            </form>
        </section>
    );
}
