import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listTownships } from "@/features/townships/server/dal";
import { formatMoney } from "@/lib/format";

export default async function TownshipsPage() {
  const townships = await listTownships();

  return (
    <>
      <PageHeader
        title="Townships"
        description="Township-based delivery pricing used to auto-fill parcel delivery fees."
        actions={
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" />
                Add Township
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Township</DialogTitle>
                <DialogDescription>Dialog placeholder for delivery pricing fields.</DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Base Fee</TableHead>
              <TableHead className="text-right">Base Weight</TableHead>
              <TableHead className="text-right">Extra Weight Fee</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {townships.map((township) => (
              <TableRow key={township.id}>
                <TableCell className="font-medium">{township.name}</TableCell>
                <TableCell className="text-right">{formatMoney(township.baseFee)} MMK</TableCell>
                <TableCell className="text-right">{township.baseWeightKg}kg</TableCell>
                <TableCell className="text-right">{formatMoney(township.extraWeightFee)} MMK</TableCell>
                <TableCell>
                  <StatusBadge
                    label={township.isActive ? "Active" : "Inactive"}
                    variant={township.isActive ? "success" : "secondary"}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
