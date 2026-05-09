import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listMerchants } from "@/features/merchants/server/dal";
import { formatMoney } from "@/lib/format";

export default async function MerchantsPage() {
  const merchants = await listMerchants();

  return (
    <>
      <PageHeader
        title="Merchants"
        description="Merchant profiles, parcel ownership, and settlement entry points."
        actions={
          <Button>
            <Plus className="size-4" />
            Add Merchant
          </Button>
        }
      />
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
            {merchants.map((merchant) => (
              <TableRow key={merchant.id}>
                <TableCell className="font-medium">{merchant.shopName}</TableCell>
                <TableCell>{merchant.ownerName}</TableCell>
                <TableCell>{merchant.phoneNumber}</TableCell>
                <TableCell>{merchant.address}</TableCell>
                <TableCell className="text-right">{merchant.parcelCount}</TableCell>
                <TableCell className="text-right">{formatMoney(merchant.pendingPayment)} MMK</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
