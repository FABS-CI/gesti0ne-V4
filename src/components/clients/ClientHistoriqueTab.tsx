import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getClientHistorique } from "@/lib/crm-api";
import { formatDate, formatFCFA } from "@/lib/format";
import { exportCsv } from "@/lib/export-csv";
import { Download } from "lucide-react";
import { useExercice } from "@/contexts/ExerciceContext";

export function ClientHistoriqueTab({ clientId }: { clientId: string }) {
  const { exerciceConsulte } = useExercice();
  const { data: rawData = [], isLoading } = useQuery({
    queryKey: ["client-historique", clientId],
    queryFn: () => getClientHistorique(clientId),
  });
  const data = useMemo(() => {
    if (!exerciceConsulte) return rawData;
    const debut = exerciceConsulte.date_debut;
    const fin = exerciceConsulte.date_fin;
    return rawData.filter((l) => l.date_commande >= debut && l.date_commande <= fin);
  }, [rawData, exerciceConsulte]);

  const stats = useMemo(() => {
    const byProd = new Map<string, number>();
    const byCat = new Map<string, number>();
    const byNiv = new Map<string, number>();
    let ca = 0;
    let qte = 0;
    const commandes = new Set<string>();
    for (const l of data) {
      commandes.add(l.commande_id);
      ca += Number(l.total_ligne) || 0;
      qte += l.quantite;
      byProd.set(l.produit_titre, (byProd.get(l.produit_titre) ?? 0) + l.quantite);
      if (l.categorie) byCat.set(l.categorie, (byCat.get(l.categorie) ?? 0) + l.quantite);
      if (l.niveau) byNiv.set(l.niveau, (byNiv.get(l.niveau) ?? 0) + l.quantite);
    }
    const top = (m: Map<string, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    return {
      ca,
      qte,
      nbCommandes: commandes.size,
      ticket: commandes.size ? Math.round(ca / commandes.size) : 0,
      topProduit: top(byProd),
      topCategorie: top(byCat),
      topNiveau: top(byNiv),
      premiere: data[data.length - 1]?.date_commande,
      derniere: data[0]?.date_commande,
    };
  }, [data]);

  function handleExport() {
    exportCsv(
      `historique_client_${clientId.slice(0, 8)}`,
      ["Date", "Commande", "Produit", "Niveau", "Catégorie", "Qté", "PU", "Total"],
      data.map((l) => [
        l.date_commande,
        l.commande_reference,
        l.produit_titre,
        l.niveau ?? "",
        l.categorie ?? "",
        l.quantite,
        l.prix_unitaire,
        l.total_ligne,
      ]),
      {
        pageTitle: "HISTORIQUE CLIENT",
        summary: [
          { label: "Lignes de commande", value: String(data.length) },
          { label: "Commandes distinctes", value: String(stats.nbCommandes) },
          { label: "Quantité totale", value: String(stats.qte) },
          { label: "Montant commandé", value: formatFCFA(stats.ca) },
          { label: "Ticket moyen", value: formatFCFA(stats.ticket) },
        ],
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Montant commandé" value={formatFCFA(stats.ca)} />
        <Kpi label="Commandes" value={String(stats.nbCommandes)} />
        <Kpi label="Quantité totale" value={String(stats.qte)} />
        <Kpi label="Ticket moyen" value={formatFCFA(stats.ticket)} />
        <Kpi label="Produit préféré" value={stats.topProduit} />
        <Kpi label="Catégorie préférée" value={stats.topCategorie} />
        <Kpi label="Niveau préféré" value={stats.topNiveau} />
        <Kpi
          label="Période d'activité"
          value={
            stats.premiere
              ? `${formatDate(stats.premiere)} → ${formatDate(stats.derniere!)}`
              : "—"
          }
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Lignes d'achat</CardTitle>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!data.length}>
            <Download className="mr-2 h-4 w-4" /> Exporter
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Commande</TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>Niveau</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead className="text-right">Qté</TableHead>
                <TableHead className="text-right">PU</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    Chargement…
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    Aucun achat enregistré
                  </TableCell>
                </TableRow>
              ) : (
                data.map((l) => (
                  <TableRow key={l.commande_id + l.produit_titre + l.date_commande}>
                    <TableCell>{formatDate(l.date_commande)}</TableCell>
                    <TableCell className="font-mono text-xs">{l.commande_reference}</TableCell>
                    <TableCell>{l.produit_titre}</TableCell>
                    <TableCell>
                      {l.niveau ? <Badge variant="outline">{l.niveau}</Badge> : "—"}
                    </TableCell>
                    <TableCell>{l.categorie ?? "—"}</TableCell>
                    <TableCell className="text-right">{l.quantite}</TableCell>
                    <TableCell className="text-right">{formatFCFA(l.prix_unitaire)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatFCFA(l.total_ligne)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

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
