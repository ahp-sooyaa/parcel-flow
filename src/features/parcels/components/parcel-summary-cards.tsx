import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ParcelSummaryDto } from "@/features/parcels/server/dto";
import { formatMoney } from "@/lib/format";

export function ParcelSummaryCards({ summary }: { summary: ParcelSummaryDto }) {
  const cards = [
    { label: "Total Parcels", value: summary.totalParcels },
    { label: "At Office", value: summary.atOffice },
    { label: "On The Way", value: summary.onTheWay },
    { label: "Delivered", value: summary.delivered },
    { label: "Expected Collection", value: `${formatMoney(summary.expectedCollection)} MMK` },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-2xl font-semibold">{card.value}</CardContent>
        </Card>
      ))}
    </div>
  );
}
