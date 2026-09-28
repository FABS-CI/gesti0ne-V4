import { useQuery } from "@tanstack/react-query";
import { Scale, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatFCFA } from "@/lib/format";
import { friendlyError } from "@/lib/friendly-error";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Report = {
  clients: { client_id: string; nom: string; solde_calcule: number; solde_enregistre: number; ecart: number }[];
  factures: {
    facture_id: string; reference: string; client: string | null; total: number;
    paye_calcule: number; paye_enregistre: number; reste_calcule: number; reste_enregistre: number; ecart: number;
  }[];
  paiements: { actifs: number; annules: number; affectes: number; supprimes: number };
};

export function ReconciliationFinanceCard() {
  const q = useQuery({
    queryKey: ["dq", "reconciliation-finance"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("report_reconciliation_finance" as never);
      if (error) throw error;
      return data as unknown as Report;
    },
  });
  const r = q.data;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-5 w-5" /> Réconciliation financière
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
          <RefreshCw className={`h-4 w-4 mr-1 ${q.isFetching ? "animate-spin" : ""}`} /> Recontrôler
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {q.error && <p className="text-sm text-destructive">{friendlyError(q.error)}</p>}
        {q.isLoading && <p className="text-sm text-muted-foreground">Contrôle en cours…</p>}
        {r && (
          <>
            <div className="grid gap-3 sm:grid-cols-4 text-sm">
              <Stat label="Paiements actifs" value={formatFCFA(r.paiements.actifs)} />
              <Stat label="Affectés aux factures" value={formatFCFA(r.paiements.affectes)} />
              <Stat label="Annulés / rejetés" value={formatFCFA(r.paiements.annules)} />
              <Stat label="Supprimés définitivement" value={formatFCFA(r.paiements.supprimes)} />
            </div>

            <section>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                Soldes clients <Badge variant={r.clients.length ? "destructive" : "secondary"}>{r.clients.length} écart(s)</Badge>
              </h3>
              {r.clients.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tous les soldes clients correspondent à leurs factures.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Client</TableHead><TableHead className="text-right">Solde calculé</TableHead>
                    <TableHead className="text-right">Solde enregistré</TableHead><TableHead className="text-right">Écart</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {r.clients.map((c) => (
                      <TableRow key={c.client_id}>
                        <TableCell>{c.nom}</TableCell>
                        <TableCell className="text-right">{formatFCFA(c.solde_calcule)}</TableCell>
                        <TableCell className="text-right">{formatFCFA(c.solde_enregistre)}</TableCell>
                        <TableCell className="text-right text-destructive">{formatFCFA(c.ecart)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>

            <section>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                Factures <Badge variant={r.factures.length ? "destructive" : "secondary"}>{r.factures.length} écart(s)</Badge>
              </h3>
              {r.factures.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chaque facture a un montant payé égal aux paiements affectés.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Facture</TableHead><TableHead>Client</TableHead><TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Reste calculé</TableHead><TableHead className="text-right">Reste enregistré</TableHead>
                    <TableHead className="text-right">Écart</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {r.factures.map((f) => (
                      <TableRow key={f.facture_id}>
                        <TableCell>{f.reference}</TableCell><TableCell>{f.client ?? "—"}</TableCell>
                        <TableCell className="text-right">{formatFCFA(f.total)}</TableCell>
                        <TableCell className="text-right">{formatFCFA(f.reste_calcule)}</TableCell>
                        <TableCell className="text-right">{formatFCFA(f.reste_enregistre)}</TableCell>
                        <TableCell className="text-right text-destructive">{formatFCFA(f.ecart)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
