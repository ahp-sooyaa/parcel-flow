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
import { listSettlements } from "@/features/settlements/server/dal";
import { formatDate, formatMoney } from "@/lib/format";

function getSettlementStatusLabel(status: "in_progress" | "settled" | "void") {
  if (status === "in_progress") {
    return "In Progress";
  }

  if (status === "settled") {
    return "Settled";
  }

  return "Void";
}

function getSettlementStatusVariant(status: "in_progress" | "settled" | "void") {
  if (status === "settled") {
    return "success";
  }

  if (status === "void") {
    return "destructive";
  }

  return "warning";
}

export default async function SettlementsPage() {
  const settlements = await listSettlements();

  return (
    <>
      <PageHeader
        title="Merchant Settlements"
        description="Create settlement drafts from COD remit and returned-parcel deduction financial items."
        actions={
          <Sheet>
            <SheetTrigger asChild>
              <Button>
                <Plus className="size-4" />
                Create Settlement
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Create Settlement Draft</SheetTitle>
                <SheetDescription>
                  Sheet placeholder for merchant selection, eligible financial items, and net
                  payment summary.
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
              <TableHead>Merchant</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">COD</TableHead>
              <TableHead className="text-right">Deductions</TableHead>
              <TableHead className="text-right">Net Payment</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {settlements.map((settlement) => (
              <TableRow key={settlement.id}>
                <TableCell className="font-medium">{settlement.settlementCode}</TableCell>
                <TableCell>{settlement.merchantName}</TableCell>
                <TableCell>
                  <StatusBadge
                    label={getSettlementStatusLabel(settlement.status)}
                    variant={getSettlementStatusVariant(settlement.status)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  {formatMoney(settlement.totalCodAmount)}
                </TableCell>
                <TableCell className="text-right">
                  {formatMoney(settlement.totalDeliveryFeeDeduction)}
                </TableCell>
                <TableCell className="text-right">
                  {formatMoney(settlement.netPaymentAmount)} MMK
                </TableCell>
                <TableCell>{formatDate(settlement.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
