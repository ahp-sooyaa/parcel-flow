import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listMerchantContacts } from "@/features/merchant-contacts/server/dal";

export default async function MerchantContactsPage() {
  const contacts = await listMerchantContacts();

  return (
    <>
      <PageHeader
        title="Merchant Contacts"
        description="Saved receiver records used to auto-fill parcel creation without rewriting old parcels."
        actions={
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Merchant Contact</DialogTitle>
                <DialogDescription>
                  Dialog placeholder for receiver and township details.
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Merchant</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Township</TableHead>
              <TableHead>Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell>{contact.merchantName}</TableCell>
                <TableCell className="font-medium">{contact.recipientName}</TableCell>
                <TableCell>{contact.recipientPhoneNumber}</TableCell>
                <TableCell>{contact.townshipName}</TableCell>
                <TableCell>{contact.recipientAddress}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
