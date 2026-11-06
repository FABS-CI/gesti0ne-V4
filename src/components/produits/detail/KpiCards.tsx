import { Card, CardContent } from "@/components/ui/card";
import { formatFCFA } from "@/lib/format";
import { usePermissions } from "@/hooks/use-permissions";

interface Props {
  stockValorise: number;
  stats:
    | {
        ca30?: number;
        qte30?: number;
        marge30?: number;
        margePct30?: number;
        rotation90?: number;
        qte90?: number;
      }
    | undefined;
}

export function KpiCards({ stockValorise, stats }: Props) {
  const { has } = usePermissions();
  const canSeeCouts = has("produits.voir_couts");
  const canSeeCA = has("produits.voir_ca") || has("commandes.voir_ca") || has("dashboard.voir_ca");
  const canSeeMarges = has("produits.voir_marges");

  const cards = [
    {
      label: "Stock valorisé",
      value: canSeeCouts ? formatFCFA(stockValorise) : "—",
      sub: null as string | null,
    },
    {
      label: "CA 30j",
      value: canSeeCA ? formatFCFA(stats?.ca30 ?? 0) : "—",
      sub: `${stats?.qte30 ?? 0} u. vendues`,
      highlight: true,
    },
    {
      label: "Marge 30j",
      value: canSeeMarges ? formatFCFA(stats?.marge30 ?? 0) : "—",
      sub: canSeeMarges ? `${(stats?.margePct30 ?? 0).toFixed(1)} %` : null,
    },
    {
      label: "Rotation 90j",
      value: `${(stats?.rotation90 ?? 0).toFixed(2)}×`,
      sub: `${stats?.qte90 ?? 0} u. vendues`,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((k) => (
        <Card key={k.label}>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{k.label}</p>
            <p className={`mt-2 truncate text-xl font-semibold tabular-nums tracking-tight ${k.highlight ? "text-primary" : ""}`}>
              {k.value}
            </p>
            {k.sub ? <p className="text-xs text-muted-foreground">{k.sub}</p> : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
