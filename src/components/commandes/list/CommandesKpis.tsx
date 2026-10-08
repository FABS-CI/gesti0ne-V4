import { ShoppingCart, Wallet, Clock, CheckCircle2 } from "lucide-react";
import { formatFCFA } from "@/lib/format";

export type Kpis = { moisCount: number; ca: number; enAttente: number; livrees: number };

export function CommandesKpis({ kpis }: { kpis: Kpis }) {
  const items = [
    {
      label: "Commandes du mois",
      value: kpis.moisCount,
      icon: ShoppingCart,
      tint: "text-primary bg-primary/10",
    },
    {
      label: "Montant commandé",
      value: formatFCFA(kpis.ca),
      icon: Wallet,
      tint: "text-success bg-success/10",
    },
    {
      label: "En attente",
      value: kpis.enAttente,
      icon: Clock,
      tint: "text-warning bg-warning/10",
    },
    {
      label: "Livrées",
      value: kpis.livrees,
      icon: CheckCircle2,
      tint: "text-info bg-info/10",
    },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((k) => (
        <div
          key={k.label}
          className="relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{k.label}</p>
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${k.tint}`}>
              <k.icon className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 truncate text-2xl font-bold tracking-tight">{k.value}</p>
        </div>
      ))}
    </div>
  );
}
