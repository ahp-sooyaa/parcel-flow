import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listRiders } from "@/features/riders/server/dal";
import { isAdminRole } from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import { requireCurrentUser } from "@/lib/session";

export default async function RidersPage() {
  const currentUser = await requireCurrentUser();

  if (!isAdminRole(currentUser.role)) {
    throw new Error("Admin access required.");
  }

  const riders = await listRiders();

  return (
    <>
      <PageHeader
        title="Riders"
        description="Rider service areas, assigned parcels, and expected versus actual collection."
        actions={
          <Button>
            <Plus className="size-4" />
            Add Rider
          </Button>
        }
      />
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
            {riders.map((rider) => (
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
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
