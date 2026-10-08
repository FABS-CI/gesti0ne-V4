import { formatDateTime } from "@/lib/format";
import { Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { generateRecapCoutsTourneePDF } from "@/lib/pdf/tourneePdf";
import { viewCached } from "@/lib/pdf/actions";
import { CATEGORIES, fmtFCFA, statutMeta, type TourneeCout } from "./types";

export function DetailDialog({
  row,
  onClose,
}: {
  row: TourneeCout | null;
  onClose: () => void;
}) {
  if (!row) return null;
  const meta = statutMeta(row.validation_statut);
  const openPdf = () =>
    viewCached(
      `recap-couts-${row.tournee_id}`,
      () => generateRecapCoutsTourneePDF(row.tournee_id),
      {
        title: `Récapitulatif coûts — ${row.reference}`,
        filename: `recap-couts-${row.reference}.pdf`,
      },
    );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Détail des coûts — {row.reference}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-muted-foreground">Date : </span>
              {row.date_tournee ?? "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Chauffeur : </span>
              {row.chauffeur_nom ?? "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Responsable : </span>
              {row.responsable_nom ?? "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Véhicule : </span>
              {row.vehicules?.immatriculation ?? "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Type : </span>
              {row.type_tournee ?? "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Statut : </span>
              <Badge variant="outline">{meta.label}</Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Clients : </span>
              {row.nb_clients}
            </div>
            <div>
              <span className="text-muted-foreground">Colis / Cartons : </span>
              {row.nb_colis} / {row.nb_cartons}
            </div>
            {row.mode_reglement && (
              <div>
                <span className="text-muted-foreground">Règlement : </span>
                {row.mode_reglement}
              </div>
            )}
            {row.validation_at && (
              <div>
                <span className="text-muted-foreground">Validé le : </span>
                {formatDateTime(row.validation_at)}
              </div>
            )}
          </div>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-muted/40 text-left">
                <th className="border p-2">Catégorie</th>
                <th className="border p-2 text-right">Montant</th>
                <th className="border p-2 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((c) => {
                const v = Number(row[c.key] ?? 0);
                const pct = row.cout_total ? Math.round((v / Number(row.cout_total)) * 100) : 0;
                return (
                  <tr key={String(c.key)}>
                    <td className="border p-2">{c.label}</td>
                    <td className="border p-2 text-right tabular-nums">{fmtFCFA(v)}</td>
                    <td className="border p-2 text-right">{pct}%</td>
                  </tr>
                );
              })}
              <tr className="font-semibold bg-muted/20">
                <td className="border p-2">TOTAL</td>
                <td className="border p-2 text-right tabular-nums">{fmtFCFA(row.cout_total)}</td>
                <td className="border p-2 text-right">100%</td>
              </tr>
            </tbody>
          </table>
          {row.validation_commentaire && (
            <div className="rounded bg-muted/40 p-2 text-xs">
              <b>Commentaire :</b> {row.validation_commentaire}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button onClick={openPdf}>
            <Printer className="mr-2 h-4 w-4" /> Aperçu / Imprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
