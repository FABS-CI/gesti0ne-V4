import { Skeleton } from "@/components/ui/skeleton";
import { formatFCFA, formatNumber } from "@/lib/format";
import type { RapportKpi } from "@/lib/rapports-api";
import { computeVariation, formatPct, formatVariation } from "@/lib/rapports-kpi";
import { cn } from "@/lib/utils";

type Main = { label: string; value: number; prev?: number; inverse?: boolean };

function MainKpi({ label, value, prev, inverse, compare }: Main & { compare: boolean }) {
  const v = compare ? computeVariation(value, prev, inverse) : null;
  return (
    <div className="min-w-0 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 truncate text-xl font-semibold tabular-nums",
          value === 0 ? "text-muted-foreground" : "text-foreground",
        )}
        title={formatFCFA(value)}
      >
        {formatFCFA(value)}
      </p>
      {v && (
        <p
          className={cn(
            "mt-1 text-xs tabular-nums",
            v.favorable ? "text-success" : "text-destructive",
          )}
        >
          {formatVariation(v)}
          <span className="ml-1 text-muted-foreground">vs période précédente</span>
        </p>
      )}
    </div>
  );
}

export function RapportKpisGrid({
  data,
  previous,
  compare = false,
}: {
  data: RapportKpi | undefined;
  previous?: RapportKpi;
  compare?: boolean;
}) {
  if (!data) {
    return (
      <div className="rounded-lg border" aria-busy="true" aria-label="Chargement des indicateurs">
        <div className="grid grid-cols-2 divide-x lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-4">
              <Skeleton className="mb-2 h-3 w-20" />
              <Skeleton className="h-6 w-32" />
            </div>
          ))}
        </div>
        <div className="border-t px-4 py-3">
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  const cmp = compare && !!previous;
  const taux = Math.max(0, Math.min(100, Number(data.taux_encaissement ?? 0)));
  const mains: Main[] = [
    { label: "CA facturé", value: data.montant_facture ?? 0, prev: previous?.montant_facture },
    { label: "CA encaissé", value: data.montant_encaisse ?? 0, prev: previous?.montant_encaisse },
    {
      label: "Reste à encaisser",
      value: data.reste_a_encaisser ?? 0,
      prev: previous?.reste_a_encaisser,
      inverse: true,
    },
    { label: "Panier moyen", value: data.panier_moyen ?? 0, prev: previous?.panier_moyen },
  ];
  const secondary = [
    ["Qté vendue", formatNumber(data.qte_vendue)],
    ["Factures", formatNumber(data.nb_factures)],
    ["Clients actifs", formatNumber(data.nb_clients)],
  ] as const;

  return (
    <section className="rounded-lg border bg-card" aria-label="Indicateurs de la période">
      <div className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x [&>*:nth-child(2)]:sm:border-l [&>*:nth-child(n+3)]:sm:border-t [&>*:nth-child(n+3)]:lg:border-t-0">
        {mains.map((m) => (
          <MainKpi key={m.label} {...m} compare={cmp} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t px-4 py-2.5 text-sm">
        {secondary.map(([l, v]) => (
          <span key={l} className="tabular-nums">
            <span className="text-muted-foreground">{l} </span>
            <span className="font-medium">{v}</span>
          </span>
        ))}
        <span className="flex min-w-[12rem] flex-1 items-center gap-2 tabular-nums">
          <span className="text-muted-foreground">Taux d'encaissement</span>
          <span className="font-medium">{formatPct(taux)}</span>
          <span
            className="h-1.5 max-w-40 flex-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={Math.round(taux)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Taux d'encaissement"
          >
            <span className="block h-full bg-primary" style={{ width: `${taux}%` }} />
          </span>
        </span>
      </div>
    </section>
  );
}
