import { AlertTriangle, CheckCircle2, Loader2, Scale } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatFCFA, formatDate } from "@/lib/format";
import type { PreviewResult } from "./exercices-shared";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  preview: PreviewResult | undefined;
  loading: boolean;
  activerSuivant: boolean;
  setActiverSuivant: (v: boolean) => void;
  onValidate: () => void;
  submitting: boolean;
};

export function CloturePreviewDialog({
  open,
  onOpenChange,
  preview,
  loading,
  activerSuivant,
  setActiverSuivant,
  onValidate,
  submitting,
}: Props) {
  // Bloquants d'abord, puis points à vérifier.
  const blocages = [...(preview?.blocages ?? [])].sort((a, b) =>
    a.severite === b.severite ? 0 : a.severite === "error" ? -1 : 1,
  );
  const equilibre =
    !!preview && Math.abs(preview.comptes.total_debit - preview.comptes.total_credit) < 0.01;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aperçu de clôture</DialogTitle>
          <DialogDescription>
            Contrôles comptables de l&apos;exercice. La clôture n&apos;est possible que sans
            anomalie bloquante.
          </DialogDescription>
        </DialogHeader>

        {loading || !preview ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Calcul en cours…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Exercice à clôturer</p>
              <p className="font-semibold">
                {preview.exercice.code} ({formatDate(preview.exercice.date_debut)} →{" "}
                {formatDate(preview.exercice.date_fin)})
              </p>
              {preview.exercice_suivant && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Suivant : <strong>{preview.exercice_suivant.code}</strong>
                  {preview.exercice_suivant.a_creer && " (sera créé)"}
                </p>
              )}
            </div>

            <div className="rounded-lg border p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                <Scale className="h-3.5 w-3.5" /> Écritures de l&apos;exercice
              </p>
              <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div className="flex justify-between">
                  <span>Écritures</span>
                  <span className="font-medium">{preview.comptes.nb_ecritures}</span>
                </div>
                <div className="flex justify-between">
                  <span>Débit = crédit</span>
                  <span
                    className={
                      equilibre ? "font-medium text-success" : "font-medium text-destructive"
                    }
                  >
                    {formatFCFA(preview.comptes.total_debit)}
                    {equilibre ? "" : ` ≠ ${formatFCFA(preview.comptes.total_credit)}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Produits (classe 7)</span>
                  <span className="font-medium">{formatFCFA(preview.comptes.produits)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Charges (classe 6)</span>
                  <span className="font-medium">{formatFCFA(preview.comptes.charges)}</span>
                </div>
                <div className="flex justify-between sm:col-span-2">
                  <span>Résultat (classes 6 à 8)</span>
                  <span
                    className={
                      preview.comptes.resultat < 0
                        ? "font-semibold text-destructive"
                        : "font-semibold text-success"
                    }
                  >
                    {preview.comptes.resultat < 0 ? "Perte " : "Bénéfice "}
                    {formatFCFA(Math.abs(preview.comptes.resultat))}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Les soldes des comptes de bilan passent d&apos;eux-mêmes à l&apos;exercice suivant
                (balance cumulée) ; le résultat va au report à nouveau tant qu&apos;il n&apos;est
                pas affecté.
              </p>
            </div>

            {blocages.map((b) => (
              <Alert key={b.code} variant={b.severite === "error" ? "destructive" : "default"}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="text-xs uppercase">
                  {b.severite === "error" ? "Bloquant" : "À vérifier"}
                </AlertTitle>
                <AlertDescription>{b.message}</AlertDescription>
              </Alert>
            ))}

            <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
              <Checkbox
                checked={activerSuivant}
                onCheckedChange={(v) => setActiverSuivant(v === true)}
              />
              <span>
                Activer immédiatement l&apos;exercice suivant (
                <strong>{preview.exercice_suivant?.code ?? "—"}</strong>) après la clôture.
              </span>
            </label>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button disabled={!preview?.peut_cloturer || submitting} onClick={onValidate}>
            <CheckCircle2 className="mr-1 h-4 w-4" />
            Valider la clôture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
