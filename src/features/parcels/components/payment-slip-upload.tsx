"use client";

import { ExternalLinkIcon, ImageIcon, TriangleAlertIcon, UploadIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { FormFieldError } from "@/components/shared/form-field-error";
import { buttonVariants } from "@/components/ui/button";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type PaymentSlipImageAsset = {
    key: string;
    url: string;
};

type PaymentSlipUploadProps = {
    mode: "create" | "edit";
    existingImages?: PaymentSlipImageAsset[];
    errorMessage?: string;
    showMissingWarning?: boolean;
};

type LocalPreview = {
    name: string;
    url: string;
};

function formatSelectedTitle(fileCount: number) {
    return `${fileCount} payment slip image${fileCount === 1 ? "" : "s"} selected`;
}

export function PaymentSlipUpload({
    mode,
    existingImages = [],
    errorMessage,
    showMissingWarning = false,
}: Readonly<PaymentSlipUploadProps>) {
    const [selectedPreviews, setSelectedPreviews] = useState<LocalPreview[]>([]);
    const hasExistingImages = existingImages.length > 0;
    const hasSelectedPreviews = selectedPreviews.length > 0;
    const emptyTitle =
        mode === "create" ? "Upload Shared Payment Slip Images" : "Upload Payment Slip Images";
    const emptyDescription =
        mode === "create"
            ? "Add JPG, PNG, or WEBP images once and they will be attached to every parcel payment record in this batch."
            : hasExistingImages
              ? "Add JPG, PNG, or WEBP images. Existing payment slips stay attached and new uploads are appended after you save."
              : "Add JPG, PNG, or WEBP images and save the parcel to record the missing payment proof.";
    const previewDescription =
        mode === "create"
            ? "Previewing selected files locally. They upload only when you create the parcels."
            : hasExistingImages
              ? "Previewing new files locally. Existing payment slips stay attached until you save."
              : "Previewing selected files locally. Save the parcel to record the missing payment proof.";
    const actionLabel = hasSelectedPreviews
        ? "Change Images"
        : mode === "edit" && hasExistingImages
          ? "Update Slip"
          : "Choose Images";

    useEffect(() => {
        return () => {
            for (const preview of selectedPreviews) {
                URL.revokeObjectURL(preview.url);
            }
        };
    }, [selectedPreviews]);

    return (
        <div className="grid gap-3">
            <Label htmlFor="paymentSlipImages">Payment Slip Images</Label>

            <input
                id="paymentSlipImages"
                name="paymentSlipImages"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only hidden"
                onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);

                    setSelectedPreviews(
                        files.map((file) => ({
                            name: file.name,
                            url: URL.createObjectURL(file),
                        })),
                    );
                }}
            />

            {showMissingWarning && !hasExistingImages ? (
                <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
                    <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
                    <div className="space-y-1">
                        <p className="text-sm font-semibold">Payment proof is missing</p>
                        <p className="text-xs">
                            This prepaid bank transfer parcel has no saved payment slip yet. Upload
                            and save one to complete the record.
                        </p>
                    </div>
                </div>
            ) : null}

            {hasExistingImages ? (
                <div className="grid gap-3 rounded-xl border bg-background p-4">
                    <div className="space-y-1">
                        <p className="text-sm font-semibold">
                            Saved Payment Slip{existingImages.length === 1 ? "" : "s"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Review the current proof. New uploads are appended after you save.
                        </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        {existingImages.map((image, index) => (
                            <div
                                key={image.key}
                                className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-[96px_minmax(0,1fr)] sm:items-center"
                            >
                                <img
                                    src={image.url}
                                    alt={`Saved payment slip ${index + 1}`}
                                    className="h-24 w-full rounded-md object-cover sm:w-24"
                                />
                                <div className="space-y-2">
                                    <p className="text-sm font-medium">Slip {index + 1}</p>
                                    <a
                                        href={image.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={cn(
                                            buttonVariants({ variant: "secondary", size: "sm" }),
                                            "w-fit",
                                        )}
                                    >
                                        <ExternalLinkIcon className="size-3.5" />
                                        View / Download
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>

                    {!hasSelectedPreviews ? (
                        <div>
                            <label
                                htmlFor="paymentSlipImages"
                                className={cn(
                                    buttonVariants({ variant: "outline", size: "sm" }),
                                    "cursor-pointer",
                                )}
                            >
                                <UploadIcon className="size-3.5" />
                                {actionLabel}
                            </label>
                        </div>
                    ) : null}
                </div>
            ) : null}

            {hasSelectedPreviews ? (
                <div className="grid gap-3 rounded-xl border bg-background p-4">
                    <div className="space-y-1">
                        <p className="text-sm font-semibold">
                            {formatSelectedTitle(selectedPreviews.length)}
                        </p>
                        <p className="text-xs text-muted-foreground">{previewDescription}</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {selectedPreviews.map((preview) => (
                            <div
                                key={preview.url}
                                className="space-y-2 rounded-lg border bg-card p-3"
                            >
                                <img
                                    src={preview.url}
                                    alt={preview.name}
                                    className="h-32 w-full rounded-md object-cover"
                                />
                                <p className="truncate text-xs text-muted-foreground">
                                    {preview.name}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div>
                        <label
                            htmlFor="paymentSlipImages"
                            className={cn(
                                buttonVariants({ variant: "outline", size: "sm" }),
                                "cursor-pointer",
                            )}
                        >
                            <UploadIcon className="size-3.5" />
                            {actionLabel}
                        </label>
                    </div>
                </div>
            ) : !hasExistingImages ? (
                <Empty className="border bg-background">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <ImageIcon className="size-5" />
                        </EmptyMedia>
                        <EmptyTitle>{emptyTitle}</EmptyTitle>
                        <EmptyDescription>{emptyDescription}</EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        <label
                            htmlFor="paymentSlipImages"
                            className={cn(buttonVariants({ variant: "outline" }), "cursor-pointer")}
                        >
                            <UploadIcon className="size-4" />
                            {actionLabel}
                        </label>
                    </EmptyContent>
                </Empty>
            ) : null}

            <FormFieldError message={errorMessage} />
        </div>
    );
}
