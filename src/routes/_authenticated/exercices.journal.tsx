import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, History } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/exercices/journal")({
  component: JournalCloturePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type Row = {
  journal_id: string;
  date_cloture: string;
  cloture_par: string | null;
  nb_clients_reportes: number;
  montant_total_clients: number;
  nb_fournisseurs_reportes: number;
  montant_total_fournisseurs: number;
  source: { code: string } | null;
  cible: { code: string } | null;
};

function JournalCloturePage() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["exercice-cloture-journal"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercice_cloture_journal")
        .select(
          "journal_id, date_cloture, cloture_par, nb_clients_reportes, montant_total_clients, nb_fournisseurs_reportes, montant_total_fournisseurs, source:exercices!exercice_cloture_journal_exercice_source_id_fkey(code), cible:exercices!exercice_cloture_journal_exercice_cible_id_fkey(code)",
        )
        .order("date_cloture", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/exercices">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="ds-page-title flex items-center gap-2">
            <History className="h-6 w-6 text-primary" /> Journal de clôture
          </h1>
          <p className="text-sm text-muted-foreground">
            Historique des clôtures d'exercice et reports à-nouveau
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clôtures effectuées</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Exercice source</TableHead>
                <TableHead>Exercice cible</TableHead>
                <TableHead className="text-right">Clients reportés</TableHead>
                <TableHead className="text-right">Montant clients</TableHead>
                <TableHead className="text-right">Fournisseurs reportés</TableHead>
                <TableHead className="text-right">Montant fournisseurs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Aucune clôture enregistrée
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.journal_id}>
                    <TableCell>{new Date(r.date_cloture).toLocaleString("fr-FR")}</TableCell>
                    <TableCell className="font-mono text-xs">{r.source?.code ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.cible?.code ?? "—"}</TableCell>
                    <TableCell className="text-right">{r.nb_clients_reportes}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatFCFA(Number(r.montant_total_clients))}
                    </TableCell>
                    <TableCell className="text-right">{r.nb_fournisseurs_reportes}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatFCFA(Number(r.montant_total_fournisseurs))}
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
