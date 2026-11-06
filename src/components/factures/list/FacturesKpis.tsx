import { Card, CardContent } from "@/components/ui/card";
import { formatFCFA } from "@/lib/format";

type Props = { total: number; paye: number; du: number };

export function FacturesKpis({ total, paye, du }: Props) {
  const items = [
    { label: "Total facturé", value: total, valueClass: "" },
    { label: "Encaissé", value: paye, valueClass: "text-success" },
    { label: "Reste dû", value: du, valueClass: du > 0 ? "text-destructive" : "" },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {items.map((k) => (
        <Card key={k.label}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={`mt-1 truncate text-xl font-semibold tabular-nums ${k.valueClass}`}>
              {formatFCFA(k.value)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
