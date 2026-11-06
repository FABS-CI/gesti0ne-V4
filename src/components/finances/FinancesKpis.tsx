import { Card, CardContent } from "@/components/ui/card";
import { formatFCFA } from "@/lib/format";

type Props = { recettes: number; depenses: number; solde: number };

export function FinancesKpis({ recettes, depenses, solde }: Props) {
  const items = [
    { label: "Recettes", value: recettes, cls: "text-success" },
    { label: "Dépenses", value: depenses, cls: "text-destructive" },
    { label: "Solde", value: solde, cls: solde >= 0 ? "text-success" : "text-destructive" },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {items.map((k) => (
        <Card key={k.label}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={`text-xl font-semibold tabular-nums ${k.cls}`}>{formatFCFA(k.value)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
