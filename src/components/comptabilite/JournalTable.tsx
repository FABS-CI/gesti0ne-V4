import { Fragment } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveTable } from "@/components/layout/ResponsiveTable";
import { formatFCFA, formatDate } from "@/lib/format";
import { JOURNAL_COLORS, type Ecriture } from "@/lib/comptabilite-helpers";

interface Props {
  isLoading: boolean;
  ecritures: Ecriture[];
  expanded: string | null;
  onToggle: (id: string) => void;
}

export function JournalTable({ isLoading, ecritures, expanded, onToggle }: Props) {
  return (
    <div className="rounded-lg border">
      <ResponsiveTable stickyFirstCol>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Pièce</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Journal</TableHead>
              <TableHead>Libellé</TableHead>
              <TableHead>Lettrage</TableHead>
              <TableHead className="text-right">Montant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : ecritures.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-6">
                  <EmptyState
                    variant="rich"
                    title="Aucune écriture comptable"
                    description="Les écritures générées par vos ventes, achats et paiements alimenteront automatiquement ce journal."
                    className="border-none"
                  />
                </TableCell>
              </TableRow>
            ) : (
              ecritures.map((e) => {
                const isOpen = expanded === e.ecriture_id;
                return (
                  <Fragment key={e.ecriture_id}>
                    <TableRow className="cursor-pointer" onClick={() => onToggle(e.ecriture_id)}>
                      <TableCell>
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{e.reference}</TableCell>
                      <TableCell>{formatDate(e.date_ecriture)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          style={{
                            color: JOURNAL_COLORS[e.journal] ?? "#64748B",
                            borderColor: JOURNAL_COLORS[e.journal] ?? "#64748B",
                          }}
                        >
                          {e.journal}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{e.libelle}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {e.lettrage ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatFCFA(Number(e.montant_total))}
                      </TableCell>
                    </TableRow>
                    {isOpen &&
                      e.ecriture_lignes.map((l) => (
                        <TableRow key={l.ligne_id} className="bg-muted/40">
                          <TableCell />
                          <TableCell colSpan={3} className="pl-8 text-sm">
                            <span className="font-mono text-xs">{l.compte}</span> {l.compte_libelle}
                          </TableCell>
                          <TableCell
                            colSpan={2}
                            className="text-right text-sm text-muted-foreground"
                          >
                            {Number(l.debit) > 0 ? `Débit` : `Crédit`}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {Number(l.debit) > 0
                              ? formatFCFA(Number(l.debit))
                              : formatFCFA(Number(l.credit))}
                          </TableCell>
                        </TableRow>
                      ))}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </ResponsiveTable>
    </div>
  );
}
