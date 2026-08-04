import { Suspense } from "react";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/page-loading";
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
import { listRiders } from "@/features/riders/server/dal";
import { listTownships } from "@/features/townships/server/dal";
import { CreateUserForm } from "@/features/users/components/create-user-form";
import { isAdminRole } from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import { requireCurrentUser } from "@/lib/session";

async function RidersPageContent() {
  const currentUser = await requireCurrentUser();

  if (!isAdminRole(currentUser.role)) {
    throw new Error("Admin access required.");
  }

  const [riders, townships] = await Promise.all([listRiders(), listTownships()]);

  return (
    <div data-testid="page-dynamic-content">
      <div className="mb-4 flex justify-end" data-testid="page-header-actions">
        <Sheet>
          <Button asChild>
            <SheetTrigger>
              <Plus className="size-4" />
              Add Rider
            </SheetTrigger>
          </Button>
          <SheetContent className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:w-[500px] data-[side=right]:sm:max-w-[500px]">
            <CreateUserForm
              townships={townships}
              defaultRole="rider"
              roleOptions={["rider"]}
              title="Add Rider"
            />
          </SheetContent>
        </Sheet>
      </div>
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
      />
      <Suspense fallback={<PageLoading />}>
        <RidersPageContent />
      </Suspense>
    </>
  );
}
