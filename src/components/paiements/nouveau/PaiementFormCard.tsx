import { Link } from "@tanstack/react-router";
import { AlertCircle, FileText, Wallet } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MODES_PAIEMENT, type EnregistrerPaiementInput } from "@/lib/paiements-api";
import { formatFCFA } from "@/lib/format";

export type FormState = Omit<EnregistrerPaiementInput, "facture_id">;

type Props = {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  mode: "draft" | "confirm";
  soldeRestant?: number;
  onPreview: () => void;
  onSubmit: () => void;
  onEdit: () => void;
  onMontantChange: (montant: number) => void;
  submitting: boolean;
};

export function PaiementFormCard({
  form,
  setForm,
  mode,
  soldeRestant,
  onPreview,
  onSubmit,
  onEdit,
  onMontantChange,
  submitting,
}: Props) {
  const disabled = mode === "confirm";
  return (
    <Card>
      <SectionHeader icon={Wallet} title="3. Informations du paiement" color="#10B981" />
      <CardContent className="grid gap-4 sm:grid-cols-2 pl-5 sm:pl-6">
        {mode === "confirm" && (
          <div className="sm:col-span-2">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Mode confirmation</AlertTitle>
              <AlertDescription>
                Vérifiez le récapitulatif ci-dessous puis validez, ou cliquez sur « Modifier » pour
                ajuster le montant, la référence ou le mode de paiement.
              </AlertDescription>
            </Alert>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input
            type="date"
            value={form.date_paiement}
            onChange={(e) => setForm((s) => ({ ...s, date_paiement: e.target.value }))}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Montant payé (FCFA)</Label>
          <Input
            type="number"
            min={0}
            value={form.montant}
            onChange={(e) => onMontantChange(Number(e.target.value) || 0)}
            disabled={disabled}
          />
          {soldeRestant != null && (
            <p className="text-xs text-muted-foreground">
              Solde restant : {formatFCFA(soldeRestant)}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Mode de paiement</Label>
          <Select
            value={form.mode_paiement}
            onValueChange={(v) => setForm((s) => ({ ...s, mode_paiement: v }))}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODES_PAIEMENT.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Référence interne</Label>
          <Input
            value={form.reference_paiement ?? ""}
            onChange={(e) => setForm((s) => ({ ...s, reference_paiement: e.target.value }))}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Banque (si applicable)</Label>
          <Input
            value={form.banque ?? ""}
            onChange={(e) => setForm((s) => ({ ...s, banque: e.target.value }))}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label>N° de transaction</Label>
          <Input
            value={form.num_transaction ?? ""}
            onChange={(e) => setForm((s) => ({ ...s, num_transaction: e.target.value }))}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Observations</Label>
          <Textarea
            rows={2}
            value={form.observations ?? ""}
            onChange={(e) => setForm((s) => ({ ...s, observations: e.target.value }))}
            disabled={disabled}
          />
        </div>
        <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
          <Button asChild variant="outline">
            <Link to="/paiements">Annuler</Link>
          </Button>
          {mode === "draft" ? (
            <>
              <Button variant="outline" onClick={onPreview}>
                <FileText className="mr-2 h-4 w-4" />
                Prévisualiser
              </Button>
              <Button onClick={onSubmit} disabled={submitting}>
                💾 Enregistrer le paiement
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onEdit}>
                Modifier
              </Button>
              <Button onClick={onSubmit} disabled={submitting}>
                <FileText className="mr-2 h-4 w-4" />
                💾 Confirmer et enregistrer
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
