import { formatNumber } from "@/lib/format";
import { formatDate } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { Boxes, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/friendly-error";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type StockReport = {
  lignes_controlees: number;
  sans_mouvement: number;
  depots: {
    produit_id: string; reference: string | null; titre: string | null; depot: string;
    stock_enregistre: number; stock_mouvements: number; ecart: number;
    dernier_mouvement: string; document_reference: string | null;
  }[];
  produits: {
    produit_id: string; reference: string | null; titre: string | null;
    stock_produit: number; somme_depots: number; ecart: number;
  }[];
};

const qte = (n: number) => formatNumber(n);
const signe = (n: number) => (n > 0 ? `+${qte(n)}` : qte(n));

/** Contrôle en lecture seule : stock des dépôts comparé au dernier mouvement enregistré. */
export function ReconciliationStockCard() {
  const q = useQuery({
    queryKey: ["dq", "reconciliation-stock"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("report_reconciliation_stock");
      if (error) throw error;
      return data as unknown as StockReport;
    },
  });
  const r = q.data;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <Boxes className="h-5 w-5" /> Réconciliation du stock
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
          <RefreshCw className={`mr-1 h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /> Recontrôler
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {q.error && <p className="text-sm text-destructive">{friendlyError(q.error)}</p>}
        {q.isLoading && <p className="text-sm text-muted-foreground">Contrôle en cours…</p>}
        {r && (
          <>
            <p className="text-sm text-muted-foreground">
              {r.lignes_controlees} stock(s) produit/dépôt contrôlé(s)
              {r.sans_mouvement > 0 ? `, dont ${r.sans_mouvement} sans aucun mouvement enregistré` : ""}.
            </p>
            <section>
              <h3 className="mb-2 flex items-center gap-2 font-semibold">
                Stock des dépôts / mouvements
                <Badge variant={r.depots.length ? "destructive" : "secondary"}>{r.depots.length} écart(s)</Badge>
              </h3>
              {r.depots.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chaque stock de dépôt correspond à son dernier mouvement.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Produit</TableHead><TableHead>Dépôt</TableHead>
                      <TableHead className="text-right">Stock enregistré</TableHead>
                      <TableHead className="text-right">Selon mouvements</TableHead>
                      <TableHead className="text-right">Écart</TableHead>
                      <TableHead>Dernier mouvement</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {r.depots.map((d) => (
                        <TableRow key={`${d.produit_id}-${d.depot}`}>
                          <TableCell>{d.reference ? `${d.reference} — ` : ""}{d.titre}</TableCell>
                          <TableCell>{d.depot}</TableCell>
                          <TableCell className="text-right">{qte(d.stock_enregistre)}</TableCell>
                          <TableCell className="text-right">{qte(d.stock_mouvements)}</TableCell>
                          <TableCell className="text-right text-destructive">{signe(d.ecart)}</TableCell>
                          <TableCell>
                            {formatDate(d.dernier_mouvement)}
                            {d.document_reference ? ` · ${d.document_reference}` : ""}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
            <section>
              <h3 className="mb-2 flex items-center gap-2 font-semibold">
                Stock produit / somme des dépôts
                <Badge variant={r.produits.length ? "destructive" : "secondary"}>{r.produits.length} écart(s)</Badge>
              </h3>
              {r.produits.length === 0 ? (
                <p className="text-sm text-muted-foreground">Le stock de chaque produit égale la somme de ses dépôts.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {r.produits.map((p) => (
                    <li key={p.produit_id}>
                      {p.reference ? `${p.reference} — ` : ""}{p.titre} : {qte(p.stock_produit)} contre {qte(p.somme_depots)} dans les dépôts
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}
