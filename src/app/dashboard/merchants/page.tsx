import { Suspense } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { PageContentSkeleton } from "@/components/shared/page-content-skeleton";
import { SheetFormFallback } from "@/components/shared/sheet-form-fallback";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listMerchants } from "@/features/merchants/server/dal";
import { CreateUserFormLoader } from "@/features/users/components/create-user-form-loader";
import { CreateUserSheet } from "@/features/users/components/create-user-sheet";
import { isAdminRole } from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import { requireCurrentUser } from "@/lib/session";

async function MerchantsPageContent() {
  const currentUser = await requireCurrentUser();

  if (!isAdminRole(currentUser.role)) {
    throw new Error("Admin access required.");
  }

  const merchants = await listMerchants();

  return (
    <div data-testid="page-dynamic-content">
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shop</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Address</TableHead>
              <TableHead className="text-right">Parcels</TableHead>
              <TableHead className="text-right">Pending Payment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {merchants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No merchants.
                </TableCell>
              </TableRow>
            ) : (
              merchants.map((merchant) => (
                <TableRow key={merchant.id}>
                  <TableCell className="font-medium">{merchant.shopName}</TableCell>
                  <TableCell>{merchant.ownerName}</TableCell>
                  <TableCell>{merchant.phoneNumber}</TableCell>
                  <TableCell>{merchant.address}</TableCell>
                  <TableCell className="text-right">{merchant.parcelCount}</TableCell>
                  <TableCell className="text-right">
                    {formatMoney(merchant.pendingPayment)} MMK
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function MerchantsPage() {
  return (
    <>
      <PageHeader
        title="Merchants"
        description="Merchant profiles, parcel ownership, and settlement entry points."
        actions={
          <CreateUserSheet triggerLabel="Add Merchant">
            <Suspense fallback={<SheetFormFallback />}>
              <CreateUserFormLoader
                defaultRole="merchant"
                roleOptions={["merchant"]}
                title="Add Merchant"
              />
            </Suspense>
          </CreateUserSheet>
        }
      />
      <Suspense fallback={<PageContentSkeleton variant="table" />}>
        <MerchantsPageContent />
      </Suspense>
    </>
  );
}
