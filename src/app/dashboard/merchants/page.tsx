import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listMerchants } from "@/features/merchants/server/dal";
import { CreateUserForm } from "@/features/users/components/create-user-form";
import { listTownships } from "@/features/townships/server/dal";
import { isAdminRole } from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import { requireCurrentUser } from "@/lib/session";

export default async function MerchantsPage() {
  const currentUser = await requireCurrentUser();

  if (!isAdminRole(currentUser.role)) {
    throw new Error("Admin access required.");
  }

  const [merchants, townships] = await Promise.all([listMerchants(), listTownships()]);

  return (
    <>
      <PageHeader
        title="Merchants"
        description="Merchant profiles, parcel ownership, and settlement entry points."
        actions={
          <Sheet>
            <Button asChild>
              <SheetTrigger>
                <Plus className="size-4" />
                Add Merchant
              </SheetTrigger>
            </Button>
            <SheetContent className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:w-[500px] data-[side=right]:sm:max-w-[500px]">
              <CreateUserForm
                townships={townships}
                defaultRole="merchant"
                roleOptions={["merchant"]}
                title="Add Merchant"
              />
            </SheetContent>
          </Sheet>
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
    </>
  );
}
