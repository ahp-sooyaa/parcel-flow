"use client";

import dynamic from "next/dynamic";

import type { MerchantOptionDto } from "@/features/merchants/server/dto";
import type { TownshipListItemDto } from "@/features/townships/server/dto";

const CreateParcelForm = dynamic(
  () =>
    import("@/features/parcels/components/create-parcel-form").then(
      (module) => module.CreateParcelForm,
    ),
  {
    loading: () => (
      <div className="flex h-full items-center justify-center p-8">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" aria-hidden="true" />
      </div>
    ),
  },
);

export function LazyCreateParcelForm(
  props: Readonly<{
    merchants: MerchantOptionDto[];
    townships: TownshipListItemDto[];
  }>,
) {
  return <CreateParcelForm {...props} />;
}
