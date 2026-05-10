import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listRiderPayouts } from "@/features/rider-payouts/server/dal";
import { formatDate, formatMoney } from "@/lib/format";

function getPayoutStatusLabel(status: "in_progress" | "settled" | "void") {
  if (status === "in_progress") {
    return "In Progress";
  }

  if (status === "settled") {
    return "Settled";
  }

  return "Void";
}

function getPayoutStatusVariant(status: "in_progress" | "settled" | "void") {
  if (status === "settled") {
    return "success";
  }

  if (status === "void") {
    return "destructive";
  }

  return "warning";
}

export default async function RiderPayoutsPage() {
  const payouts = await listRiderPayouts();

  return (
    <>
      <PageHeader
        title="Rider Payouts"
        description="Draft and confirm rider payouts from delivered-way financial items."
        actions={
          <Sheet>
            <SheetTrigger asChild>
              <Button>
                <Plus className="size-4" />
                Create Payout
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Create Rider Payout Draft</SheetTitle>
                <SheetDescription>
                  Sheet placeholder for rider selection, delivered way count, fee per way, and
                  payout summary.
                </SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
        }
      />
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Rider</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ways</TableHead>
              <TableHead className="text-right">Fee / Way</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payouts.map((payout) => (
              <TableRow key={payout.id}>
                <TableCell className="font-medium">{payout.payoutCode}</TableCell>
                <TableCell>{payout.riderName}</TableCell>
                <TableCell>
                  <StatusBadge
                    label={getPayoutStatusLabel(payout.status)}
                    variant={getPayoutStatusVariant(payout.status)}
                  />
                </TableCell>
                <TableCell className="text-right">{payout.deliveredWayCount}</TableCell>
                <TableCell className="text-right">{formatMoney(payout.feePerWay)}</TableCell>
                <TableCell className="text-right">
                  {formatMoney(payout.totalPayoutAmount)} MMK
                </TableCell>
                <TableCell>{formatDate(payout.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
