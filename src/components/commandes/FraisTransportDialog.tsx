import { useEffect, useState } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatFCFA } from "@/lib/format";
import type { FraisTransport } from "@/lib/cycle-vente";

type TypeFrais = "aucun" | "livraison" | "expedition";

type Props = {
  open: boolean;
  reference?: string | null;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (frais: FraisTransport) => void;
};

/**
 * Fenêtre affichée au moment de la validation d'une commande.
 * La saisie est facultative : « Aucun frais de transport » est l'option par défaut.
 * Un seul type est possible (livraison OU expédition), jamais les deux.
 */
export function FraisTransportDialog({
  open,
  reference,
  pending,
  onOpenChange,
  onConfirm,
}: Props) {
  const [type, setType] = useState<TypeFrais>("aucun");
  const [montant, setMontant] = useState("");

  useEffect(() => {
    if (open) {
      setType("aucun");
      setMontant("");
    }
  }, [open]);

  const montantNum = Number(montant.replace(/\s/g, "").replace(",", "."));
  const montantValide =
    montant.trim() !== "" && !Number.isNaN(montantNum) && montantNum >= 0;
  const erreur =
    type === "aucun"
      ? null
      : montant.trim() === ""
        ? "Le montant est requis pour ce type de frais."
        : !montantValide
          ? "Saisissez un montant numérique supérieur ou égal à 0."
          : null;

  const disabled = Boolean(pending) || Boolean(erreur);

  function confirmer() {
    if (disabled) return;
    onConfirm(
      type === "aucun"
        ? { type: null, montant: null }
        : { type, montant: montantNum },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Frais de transport</DialogTitle>
          <DialogDescription>
            {reference ? `Commande ${reference}. ` : ""}
            Cette étape est facultative : vous pouvez valider sans frais de transport.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup
            value={type}
            onValueChange={(v) => setType(v as TypeFrais)}
            className="space-y-2"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="aucun" id="frais-aucun" />
              <Label htmlFor="frais-aucun" className="font-normal">
                Aucun frais de transport
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="livraison" id="frais-livraison" />
              <Label htmlFor="frais-livraison" className="font-normal">
                Frais de livraison
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="expedition" id="frais-expedition" />
              <Label htmlFor="frais-expedition" className="font-normal">
                Frais d'expédition
              </Label>
            </div>
          </RadioGroup>

          {type !== "aucun" && (
            <div className="space-y-1.5">
              <Label htmlFor="frais-montant">Montant (FCFA)</Label>
              <Input
                id="frais-montant"
                inputMode="decimal"
                autoFocus
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                placeholder="0"
              />
              {erreur ? (
                <p className="text-xs text-destructive">{erreur}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {formatFCFA(montantNum)}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button onClick={confirmer} disabled={disabled}>
            {pending ? "Validation…" : "Confirmer et valider"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
