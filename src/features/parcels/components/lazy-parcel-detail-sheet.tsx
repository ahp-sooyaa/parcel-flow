"use client";

import dynamic from "next/dynamic";

const ParcelDetailSheet = dynamic(
  () =>
    import("@/features/parcels/components/parcel-detail-sheet").then(
      (module) => module.ParcelDetailSheet,
    ),
  {
    loading: () => (
      <div className="flex h-full items-center justify-center p-8">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" aria-hidden="true" />
      </div>
    ),
  },
);

export { ParcelDetailSheet };
