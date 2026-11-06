import { Card, CardContent } from "@/components/ui/card";
import { formatFCFA } from "@/lib/format";

type Props = { recettes: number; depenses: number; solde: number };

export function FinancesKpis({ recettes, depenses, solde }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Recettes</p>
          <p className="text-xl font-semibold tabular-nums text-success">{formatFCFA(recettes)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Dépenses</p>
          <p className="text-xl font-semibold tabular-nums text-destructive">
            {formatFCFA(depenses)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Solde</p>
          <p
            className={`text-xl font-semibold tabular-nums ${solde >= 0 ? "text-success" : "text-destructive"}`}
          >
            {formatFCFA(solde)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
