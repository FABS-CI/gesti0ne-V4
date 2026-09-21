import { Card, CardContent } from "@/components/ui/card";
import { formatFCFA } from "@/lib/format";
import type { RapportKpi } from "@/lib/rapports-api";

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

export function RapportKpisGrid({ data }: { data: RapportKpi | undefined }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi label="CA facturé" value={formatFCFA(data?.montant_facture ?? 0)} />
      <Kpi label="CA encaissé" value={formatFCFA(data?.montant_encaisse ?? 0)} />
      <Kpi label="Reste à encaisser" value={formatFCFA(data?.reste_a_encaisser ?? 0)} />
      <Kpi label="Taux encaissement" value={`${(data?.taux_encaissement ?? 0).toFixed(1)}%`} />
      <Kpi label="Qté vendue" value={String(data?.qte_vendue ?? 0)} />
      <Kpi label="Nb factures" value={String(data?.nb_factures ?? 0)} />
      <Kpi label="Clients actifs" value={String(data?.nb_clients ?? 0)} />
      <Kpi label="Panier moyen" value={formatFCFA(data?.panier_moyen ?? 0)} />
    </div>
  );
}
