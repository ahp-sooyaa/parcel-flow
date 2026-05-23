import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MerchantOverviewSummaryDto } from "@/features/merchants/server/dto";
import { formatMoney } from "@/lib/format";

export function MerchantOverviewSummaryCards({
  summary,
}: Readonly<{
  summary: MerchantOverviewSummaryDto;
}>) {
  const cards = [
    { label: "Total COD collected", value: `${formatMoney(summary.totalCodCollected)} MMK` },
    { label: "Paid to you", value: `${formatMoney(summary.paidToYou)} MMK` },
    { label: "Total Parcels", value: summary.totalParcels },
    { label: "On the way parcels", value: summary.onTheWayParcels },
    { label: "Delivered Parcels", value: summary.deliveredParcels },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.label} className="gap-1">
          <CardHeader className="px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pt-0 text-2xl font-semibold">{card.value}</CardContent>
        </Card>
      ))}
    </div>
  );
}
