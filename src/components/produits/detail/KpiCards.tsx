import { Card, CardContent } from "@/components/ui/card";
import { Percent, RotateCw, TrendingUp, Wallet } from "lucide-react";
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
      icon: Wallet,
      color: "#0EA5E9",
      value: canSeeCouts ? formatFCFA(stockValorise) : "—",
      sub: null as string | null,
    },
    {
      label: "CA 30j",
      icon: TrendingUp,
      color: "#14B8A6",
      value: canSeeCA ? formatFCFA(stats?.ca30 ?? 0) : "—",
      sub: `${stats?.qte30 ?? 0} u. vendues`,
      highlight: true,
    },
    {
      label: "Marge 30j",
      icon: Percent,
      color: "#10B981",
      value: canSeeMarges ? formatFCFA(stats?.marge30 ?? 0) : "—",
      sub: canSeeMarges ? `${(stats?.margePct30 ?? 0).toFixed(1)} %` : null,
    },
    {
      label: "Rotation 90j",
      icon: RotateCw,
      color: "#8B5CF6",
      value: `${(stats?.rotation90 ?? 0).toFixed(2)}×`,
      sub: `${stats?.qte90 ?? 0} u. vendues`,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((k) => (
        <Card
          key={k.label}
          className="relative overflow-hidden transition-colors hover:border-primary/40"
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-1"
            style={{ backgroundColor: k.color }}
          />
          <CardContent className="p-4 pl-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">{k.label}</p>
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white shadow-sm"
                style={{ backgroundColor: k.color }}
              >
                <k.icon className="h-4 w-4" />
              </span>
            </div>
            <p
              className="mt-2 truncate text-xl font-bold tracking-tight"
              style={k.highlight ? { color: k.color } : undefined}
            >
              {k.value}
            </p>
            {k.sub ? <p className="text-xs text-muted-foreground">{k.sub}</p> : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
