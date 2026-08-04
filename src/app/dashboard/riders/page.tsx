import { Suspense } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/page-loading";
import { SheetFormFallback } from "@/components/shared/sheet-form-fallback";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listRiders } from "@/features/riders/server/dal";
import { CreateUserFormLoader } from "@/features/users/components/create-user-form-loader";
import { CreateUserSheet } from "@/features/users/components/create-user-sheet";
import { isAdminRole } from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import { requireCurrentUser } from "@/lib/session";

async function RidersPageContent() {
  const currentUser = await requireCurrentUser();

  if (!isAdminRole(currentUser.role)) {
    throw new Error("Admin access required.");
  }

  const riders = await listRiders();

  return (
    <div data-testid="page-dynamic-content">
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Service Townships</TableHead>
              <TableHead className="text-right">Active Parcels</TableHead>
              <TableHead className="text-right">Expected</TableHead>
              <TableHead className="text-right">Actual</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {riders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No riders.
                </TableCell>
              </TableRow>
            ) : (
              riders.map((rider) => (
                <TableRow key={rider.id}>
                  <TableCell className="font-medium">{rider.name}</TableCell>
                  <TableCell>{rider.phoneNumber}</TableCell>
                  <TableCell>{rider.serviceTownships.join(", ")}</TableCell>
                  <TableCell className="text-right">{rider.activeParcelCount}</TableCell>
                  <TableCell className="text-right">
                    {formatMoney(rider.expectedCollection)} MMK
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(rider.actualCollection)} MMK
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

export default function RidersPage() {
  return (
    <>
      <PageHeader
        title="Riders"
        description="Rider service areas, assigned parcels, and expected versus actual collection."
        actions={
          <CreateUserSheet triggerLabel="Add Rider">
            <Suspense fallback={<SheetFormFallback />}>
              <CreateUserFormLoader defaultRole="rider" roleOptions={["rider"]} title="Add Rider" />
            </Suspense>
          </CreateUserSheet>
        }
      />
      <Suspense fallback={<PageLoading />}>
        <RidersPageContent />
      </Suspense>
    </>
  );
}
