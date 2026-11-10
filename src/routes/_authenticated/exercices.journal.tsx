import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListCard, ListPageHeader } from "@/components/common/list/ListParts";
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
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link to="/exercices">
          <ArrowLeft className="mr-1 h-4 w-4" /> Exercices
        </Link>
      </Button>
      <ListPageHeader
        overline="Comptabilité · Exercices"
        title="Journal de clôture"
        description="Historique des clôtures d'exercice et reports à-nouveau"
      />

      <ListCard>
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
                  Chargement…
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
                  <TableCell>{formatDateTime(r.date_cloture)}</TableCell>
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
      </ListCard>
    </div>
  );
}
