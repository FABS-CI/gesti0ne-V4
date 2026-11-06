import { formatFCFA } from "@/lib/format";

export type Kpis = { moisCount: number; ca: number; enAttente: number; livrees: number };

export function CommandesKpis({ kpis }: { kpis: Kpis }) {
  const items = [
    { label: "Commandes du mois", value: kpis.moisCount },
    { label: "Montant commandé", value: formatFCFA(kpis.ca) },
    { label: "En attente", value: kpis.enAttente },
    { label: "Livrées", value: kpis.livrees },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((k) => (
        <div key={k.label} className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">{k.label}</p>
          <p className="mt-2 truncate text-2xl font-semibold tabular-nums tracking-tight">{k.value}</p>
        </div>
      ))}
    </div>
  );
}
