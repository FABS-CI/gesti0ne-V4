import { lazy, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatFCFA } from "@/lib/format";
import { buildMonthlyStats } from "@/lib/client-detail-helpers";
import type { Client, ClientRelations } from "@/lib/clients-api";

const ClientCaBarChart = lazy(() => import("@/components/charts/ClientCaBarChart"));

interface ClientStatsTabProps {
  client: Client;
  factures: ClientRelations["factures"];
  commandes?: ClientRelations["commandes"];
  paiements?: ClientRelations["paiements"];
  counts: {
    commandes: number;
    proformas: number;
    bl: number;
    avoirs: number;
    factures: number;
    paiements: number;
    livraisons: number;
  };
  /** @deprecated legacy */
  commandesCount?: number;
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try {
    return formatDate(d);
  } catch {
    return "—";
  }
}

function monthsBetween(a: Date, b: Date) {
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30)));
}

export function ClientStatsTab({
  client,
  factures,
  commandes = [],
  paiements = [],
  counts,
}: ClientStatsTabProps) {
  const caFacture = factures.reduce((s, f) => s + Number(f.montant_total), 0);
  const totalPaye = factures.reduce((s, f) => s + Number(f.montant_paye), 0);
  const soldeRestant = Math.max(0, caFacture - totalPaye);
  const facturesEnRetard = factures.filter((f) => {
    if (f.statut === "annulee" || f.statut === "avoir") return false;
    const solde = Number(f.montant_total) - Number(f.montant_paye);
    if (solde <= 0) return false;
    const d = new Date(f.date_facture);
    return Date.now() - d.getTime() > 30 * 24 * 60 * 60 * 1000;
  }).length;
  const monthlyStats = buildMonthlyStats(factures);

  const sortedFactures = [...factures].sort(
    (a, b) => new Date(b.date_facture).getTime() - new Date(a.date_facture).getTime(),
  );
  const sortedCmd = [...commandes].sort(
    (a, b) => new Date(b.date_commande).getTime() - new Date(a.date_commande).getTime(),
  );
  const sortedPay = [...paiements].sort(
    (a, b) => new Date(b.date_paiement).getTime() - new Date(a.date_paiement).getTime(),
  );
  const derniereFacture = sortedFactures[0]?.date_facture;
  const derniereCmd = sortedCmd[0]?.date_commande;
  const dernierPay = sortedPay[0]?.date_paiement;
  const premiereCmd = sortedCmd[sortedCmd.length - 1]?.date_commande;
  const clientDepuis = client.created_at ?? premiereCmd;

  const panierCmd = commandes.length
    ? commandes.reduce((s, c) => s + Number(c.montant_total || 0), 0) / commandes.length
    : 0;
  const panierFact = factures.length ? caFacture / factures.length : 0;

  const frequence =
    commandes.length > 1 && premiereCmd && derniereCmd
      ? (commandes.length / monthsBetween(new Date(premiereCmd), new Date(derniereCmd))).toFixed(1)
      : commandes.length
        ? "1.0"
        : "—";

  const stat = (label: string, value: React.ReactNode) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-lg font-bold">{value}</CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">
            CA facturé par mois (12 derniers mois)
          </CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <Suspense fallback={<Skeleton className="h-full w-full" />}>
            <ClientCaBarChart data={monthlyStats} />
          </Suspense>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stat("CA facturé", formatFCFA(caFacture))}
        {stat("Total payé", formatFCFA(totalPaye))}
        {stat("Solde restant", formatFCFA(soldeRestant))}
        {stat("Factures en retard", facturesEnRetard)}
        {stat("Nb commandes", counts.commandes)}
        {stat("Nb factures", counts.factures)}
        {stat("Nb paiements", counts.paiements)}
        {stat("Nb livraisons", counts.livraisons)}
        {stat("Nb BL", counts.bl)}
        {stat("Nb proformas", counts.proformas)}
        {stat("Nb avoirs", counts.avoirs)}
        {stat("Panier moyen (commande)", formatFCFA(panierCmd))}
        {stat("Panier moyen (facture)", formatFCFA(panierFact))}
        {stat("Fréquence achats / mois", frequence)}
        {stat("Client depuis", fmtDate(clientDepuis))}
        {stat("Première commande", fmtDate(premiereCmd))}
        {stat("Dernière commande", fmtDate(derniereCmd))}
        {stat("Dernière facture", fmtDate(derniereFacture))}
        {stat("Dernier paiement", fmtDate(dernierPay))}
      </div>
    </div>
  );
}
