"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ReceiptText, Search } from "lucide-react";

import { DateFilterPopover } from "@/components/shared/date-filter-popover";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  MerchantSettlementHistoryFiltersDto,
  MerchantSettlementHistoryPageDto,
} from "@/features/settlements/server/dto";
import { formatDate, formatMoney } from "@/lib/format";

function getSettlementStatusVariant() {
  return "success" as const;
}

export function MerchantSettlementHistoryTable({
  history,
  filters,
}: Readonly<{
  history: MerchantSettlementHistoryPageDto;
  filters: MerchantSettlementHistoryFiltersDto;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState(filters.searchTerm);

  useEffect(() => {
    setSearchTerm(filters.searchTerm);
  }, [filters.searchTerm]);

  function updateFilters(next: Partial<{ query: string; date: string | null; page: number }>) {
    const params = new URLSearchParams();
    const nextQuery = next.query ?? filters.searchTerm;
    const nextDate = next.date === undefined ? filters.createdOn : next.date;
    const nextPage = next.page ?? filters.page;

    if (nextQuery.trim()) {
      params.set("query", nextQuery.trim());
    }

    if (nextDate) {
      params.set("date", nextDate);
    }

    if (nextPage > 1) {
      params.set("page", String(nextPage));
    }

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Settlement History</h2>
          <p className="text-sm text-muted-foreground">
            Review settled remittances already paid to your merchant account.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <form
            className="w-full sm:w-[320px]"
            onSubmit={(event) => {
              event.preventDefault();
              updateFilters({ query: searchTerm, page: 1 });
            }}
          >
            <InputGroup className="rounded-lg border-border bg-white shadow-sm">
              <InputGroupAddon align="inline-start">
                <InputGroupText>
                  <Search className="size-4" />
                </InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                value={searchTerm}
                placeholder="Search settlement code"
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </InputGroup>
          </form>
          <DateFilterPopover
            label="Filter date"
            value={filters.createdOn}
            onChange={(value) => updateFilters({ date: value, page: 1 })}
          />
          {filters.searchTerm || filters.createdOn ? (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => updateFilters({ query: "", date: null, page: 1 })}
                className="rounded-lg border-border bg-white px-4 shadow-sm"
              >
                Clear filters
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Settlement</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">COD</TableHead>
              <TableHead className="text-right">Deductions</TableHead>
              <TableHead className="text-right">Net Payment</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Paid</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.settlements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <ReceiptText className="size-10 text-muted-foreground" />
                    {history.hasAnySettledSettlements ? (
                      <div>
                        <p className="font-medium text-foreground">
                          No settled settlements match the current filters.
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Try a different settlement code search or clear the date filter.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium text-foreground">No settled settlements yet.</p>
                        <p className="text-sm text-muted-foreground">
                          Paid remittances will appear here after office confirmation.
                        </p>
                      </div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              history.settlements.map((settlement) => (
                <TableRow key={settlement.id}>
                  <TableCell className="font-medium">{settlement.settlementCode}</TableCell>
                  <TableCell>
                    <StatusBadge label="Settled" variant={getSettlementStatusVariant()} />
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(settlement.totalCodAmount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(settlement.totalDeliveryFeeDeduction)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(settlement.netPaymentAmount)} MMK
                  </TableCell>
                  <TableCell>{formatDate(settlement.createdAt)}</TableCell>
                  <TableCell>{formatDate(settlement.paidAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PaginationControls
        page={history.page}
        totalPages={history.totalPages}
        onPageChange={(page) => updateFilters({ page })}
      />
    </div>
  );
}
