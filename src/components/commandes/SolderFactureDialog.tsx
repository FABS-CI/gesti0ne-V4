import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { calculateInvoicePaymentStatus } from "@/lib/factures/payment-status";
import { enregistrerPaiement } from "@/lib/paiements-api";
import { formatDocumentReference } from "@/lib/document-reference";
import { friendlyError } from "@/lib/friendly-error";
import type { Commande } from "@/lib/commandes-api";

const fmt = (n: number) =>
  `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} FCFA`;

/** Choix affichés → valeur enregistrée (modes existants) + précision éventuelle. */
const MODES = [
  { key: "especes", label: "Espèces", mode: "especes", precision: null },
  { key: "virement", label: "Virement bancaire", mode: "virement", precision: null },
  { key: "cheque", label: "Chèque", mode: "cheque", precision: null },
  { key: "wave", label: "Wave", mode: "mobile_money", precision: "Wave" },
  { key: "orange", label: "Orange Money", mode: "mobile_money", precision: "Orange Money" },
  { key: "autre", label: "Autre", mode: "autre", precision: null },
] as const;

export async function loadFactureSolde(commandeId: string) {
  const { data: fac, error } = await supabase
    .from("factures")
    .select("facture_id, reference")
    .eq("commande_id", commandeId)
    .maybeSingle();
  if (error) throw error;
  if (!fac) return null;
  const status = await calculateInvoicePaymentStatus(fac.facture_id, supabase);
  if (!status) return null;
  return { factureId: fac.facture_id, reference: fac.reference as string, ...status };
}

export function SolderFactureDialog({
  commande,
  open,
  onOpenChange,
}: {
  commande: Commande;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["facture-solde", commande.commande_id],
    queryFn: () => loadFactureSolde(commande.commande_id),
    enabled: open,
  });
  const [montant, setMontant] = useState("");
  const [modeKey, setModeKey] = useState<string>("especes");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const idemKey = useMemo(() => crypto.randomUUID(), [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (data) setMontant(String(data.resteAPayer));
  }, [data]);

  const reste = data?.resteAPayer ?? 0;
  const value = Number(montant);
  const invalid = !data || !(value > 0) || value > reste + 0.005 || !date;

  const submit = async () => {
    if (!data || invalid || saving) return;
    const m = MODES.find((x) => x.key === modeKey) ?? MODES[0];
    const observations = [m.precision, obs.trim()].filter(Boolean).join(" — ") || null;
    setSaving(true);
    try {
      await enregistrerPaiement({
        facture_id: data.factureId,
        date_paiement: date,
        montant: value,
        mode_paiement: m.mode,
        observations,
        idempotency_key: idemKey,
      });
      toast.success("Règlement enregistré");
      await qc.invalidateQueries();
      onOpenChange(false);
    } catch (e) {
      toast.error(friendlyError(e, "Échec de l'enregistrement du règlement"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Solder la facture</DialogTitle>
          <DialogDescription>Enregistrer un règlement sur la facture de cette commande.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{friendlyError(error, "Impossible de charger la facture")}</p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">Aucune facture n'est encore liée à cette commande.</p>
        ) : data.statut === "PAYÉE" ? (
          <p className="text-sm text-muted-foreground">Cette facture est déjà entièrement payée.</p>
        ) : (
          <div className="space-y-3">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border bg-muted/40 p-3 text-sm">
              <dt className="text-muted-foreground">Facture</dt>
              <dd className="text-right font-medium">{formatDocumentReference(data.reference)}</dd>
              <dt className="text-muted-foreground">Client</dt>
              <dd className="text-right font-medium">{commande.client_nom ?? "Non renseigné"}</dd>
              <dt className="text-muted-foreground">Montant total</dt>
              <dd className="text-right">{fmt(data.totalAPayer)}</dd>
              <dt className="text-muted-foreground">Déjà payé</dt>
              <dd className="text-right">{fmt(data.montantPaye)}</dd>
              <dt className="font-semibold">Reste à payer</dt>
              <dd className="text-right font-semibold">{fmt(data.resteAPayer)}</dd>
            </dl>
            <div className="space-y-1">
              <Label htmlFor="solde-montant">Montant du règlement</Label>
              <Input
                id="solde-montant"
                type="number"
                min={1}
                max={reste}
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
              />
              {value > reste + 0.005 && (
                <p className="text-xs text-destructive">Le montant dépasse le reste à payer.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Mode de paiement</Label>
                <Select value={modeKey} onValueChange={setModeKey}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODES.map((m) => (
                      <SelectItem key={m.key} value={m.key}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="solde-date">Date du paiement</Label>
                <Input id="solde-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="solde-obs">Observation</Label>
              <Textarea id="solde-obs" rows={2} maxLength={500} value={obs} onChange={(e) => setObs(e.target.value)} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Fermer
          </Button>
          {data && data.statut !== "PAYÉE" && (
            <Button onClick={submit} disabled={invalid || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enregistrer le règlement
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
