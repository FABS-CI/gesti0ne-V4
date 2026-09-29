import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatFCFA } from "@/lib/format";
import { buildEtatCompteClientPDF, loadReleveClient } from "@/lib/pdf/etat-compte-builder";
import { downloadBlob, fileNameFor } from "@/lib/pdf/fabsTemplates";
import { friendlyError } from "@/lib/friendly-error";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  client: { client_id: string; nom: string; reference: string | null; telephone?: string | null; representant?: string | null };
};

const fmtDate = (d: string) =>
  /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10).split("-").reverse().join("/") : d;

/** Relevé de compte du client consulté : mêmes données que le PDF. */
export function ClientReleveDialog({ open, onOpenChange, client }: Props) {
  const [busy, setBusy] = useState(false);
  const args = {
    clientId: client.client_id,
    clientNom: client.nom,
    clientTel: client.telephone ?? null,
    representant: client.representant ?? null,
  };
  const { data, isLoading, error } = useQuery({
    queryKey: ["releve-client", client.client_id],
    queryFn: () => loadReleveClient(args),
    enabled: open,
    staleTime: 0,
  });

  async function handlePdf() {
    try {
      setBusy(true);
      const blob = await buildEtatCompteClientPDF(args);
      downloadBlob(blob, fileNameFor(`EC_${client.reference ?? ""}`, client.nom));
    } catch (e) {
      toast.error(friendlyError(e, "Erreur PDF"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Relevé de compte — {client.nom}
            {client.reference ? ` (${client.reference})` : ""}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 text-center text-muted-foreground">Chargement…</div>
        ) : error ? (
          <div className="py-10 text-center text-destructive">{friendlyError(error, "Erreur de chargement")}</div>
        ) : data ? (
          <div className="space-y-4">
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead className="text-right">Débit</TableHead>
                    <TableHead className="text-right">Paiement</TableHead>
                    <TableHead className="text-right">Retour</TableHead>
                    <TableHead className="text-right">Solde</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lignes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                        Aucune opération
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.lignes.map((l, i) => {
                      const isRetour = l.type === "Avoir";
                      return (
                        <TableRow key={`${l.reference}-${i}`}>
                          <TableCell className="whitespace-nowrap">{fmtDate(String(l.date ?? ""))}</TableCell>
                          <TableCell className="font-mono text-xs">{l.reference}</TableCell>
                          <TableCell>{l.libelle}</TableCell>
                          <TableCell className="text-right">{formatFCFA(Number(l.debit || 0))}</TableCell>
                          <TableCell className="text-right">{formatFCFA(isRetour ? 0 : Number(l.credit || 0))}</TableCell>
                          <TableCell className="text-right">{formatFCFA(isRetour ? Number(l.credit || 0) : 0)}</TableCell>
                          <TableCell className="text-right font-medium">{formatFCFA(Number(l.soldeProgressif || 0))}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="ml-auto w-full max-w-md rounded-md border p-3 text-sm space-y-1.5">
              <div className="font-semibold">Récapitulatif</div>
              <Row label="Total Débit" value={data.totalDebit} />
              <Row label="Total Paiement" value={data.totalPaiement} />
              <Row label="Total Retours" value={data.totalRetours} />
              <Row label="Frais de transport compris dans les factures" value={data.totalTransport} />
              <div className="flex justify-between border-t pt-1.5 font-bold text-destructive">
                <span>{data.solde >= 0 ? "SOLDE DÉBITEUR (IMPAYÉ)" : "SOLDE CRÉDITEUR"}</span>
                <span>{formatFCFA(Math.abs(data.solde))}</span>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handlePdf} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                Télécharger le PDF
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium whitespace-nowrap">{formatFCFA(value)}</span>
    </div>
  );
}
