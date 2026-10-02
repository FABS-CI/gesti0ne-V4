import { formatDocumentReference } from "@/lib/document-reference";
import { FileDown, FileText, Loader2, Users, Eye, Wallet } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { EmptyState } from "@/components/common/EmptyState";
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
import { formatFCFA } from "@/lib/format";
import type { EtatCompteClient } from "@/hooks/use-etat-compte-clients";

type Props = {
  clients: EtatCompteClient[];
  isLoading: boolean;
  busy: string | null;
  historiqueBusy?: string | null;
  onPdf: (c: EtatCompteClient) => void;
  onHistorique?: (c: EtatCompteClient) => void;
};

export function EtatCompteTable({ clients, isLoading, busy, historiqueBusy, onPdf, onHistorique }: Props) {
  const navigate = useNavigate();
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Référence</TableHead>
            <TableHead>Client</TableHead>
            <TableHead className="text-right">Solde dû</TableHead>
            <TableHead>État</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                Chargement...
              </TableCell>
            </TableRow>
          ) : clients.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-6">
                <EmptyState
                  variant="rich"
                  icon={Users}
                  title="Aucun client à afficher"
                  description="Aucun client ne correspond à la recherche ou au filtre sélectionné."
                  className="border-none"
                />
              </TableCell>
            </TableRow>
          ) : (
            clients.map((c) => {
              const solde = Number(c.solde);
              const depasse = solde > Number(c.plafond_credit) && Number(c.plafond_credit) > 0;
              return (
                <TableRow key={c.client_id}>
                  <TableCell className="font-mono text-xs">{formatDocumentReference(c.reference)}</TableCell>
                  <TableCell className="font-medium">{c.nom}</TableCell>
                  <TableCell
                    className="text-right font-semibold"
                    style={{ color: solde > 0 ? "#EF4444" : "#10B981" }}
                  >
                    {formatFCFA(solde)}
                  </TableCell>
                  <TableCell>
                    {depasse ? (
                      <Badge variant="outline" style={{ color: "#EF4444", borderColor: "#EF4444" }}>
                        Plafond dépassé
                      </Badge>
                    ) : solde > 0 ? (
                      <Badge variant="outline" style={{ color: "#F97316", borderColor: "#F97316" }}>
                        Débiteur
                      </Badge>
                    ) : (
                      <Badge variant="outline" style={{ color: "#10B981", borderColor: "#10B981" }}>
                        À jour
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate({ to: "/clients/$clientId", params: { clientId: c.client_id } })}
                        title="Consulter le solde"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        Solde
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate({ to: "/paiements/nouveau", search: { clientId: c.client_id } })}
                        title="Imputer un paiement"
                      >
                        <Wallet className="h-3.5 w-3.5 mr-1.5" />
                        Paiement
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onPdf(c)}
                        disabled={busy === c.client_id}
                        title="État de compte PDF"
                      >
                        {busy === c.client_id ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <FileDown className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        PDF
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
