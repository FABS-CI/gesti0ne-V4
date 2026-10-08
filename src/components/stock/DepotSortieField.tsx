import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock, Unlock, AlertTriangle } from "lucide-react";

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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { listDepots } from "@/lib/depots-api";
import { useUserRoles, type AppRole } from "@/hooks/use-user-roles";

const OVERRIDE_ROLES: AppRole[] = [
  "super_admin",
  "directeur_general",
  "gestionnaire_stock",
  "responsable_magasinier",
];

type Props = {
  /** UUID du dépôt actuellement sélectionné (défaut : principal). */
  value: string;
  onChange: (depotId: string, motif?: string | null) => void;
  /** Étiquette personnalisée (par défaut « Dépôt de sortie »). */
  label?: string;
  /** Désactive complètement le champ (lecture seule). */
  disabled?: boolean;
};

/**
 * Champ Dépôt pour toute sortie de stock (commandes, retours, spécimens, incidents).
 * - Toujours pré-rempli avec le Dépôt Principal.
 * - Verrouillé (grisé) par défaut.
 * - Les profils autorisés (super_admin, DG, gestionnaire stock, responsable magasinier)
 *   peuvent déverrouiller via une dialog de motif et choisir un dépôt secondaire.
 */
export function DepotSortieField({ value, onChange, label = "Dépôt de sortie", disabled }: Props) {
  const { hasAny, isLoading: rolesLoading } = useUserRoles();
  const canOverride = !rolesLoading && hasAny(OVERRIDE_ROLES);

  const { data: depots = [] } = useQuery({
    queryKey: ["depots"],
    queryFn: listDepots,
  });

  const principal = depots.find((d) => d.is_principal && d.actif) ?? null;
  const [unlocked, setUnlocked] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [motif, setMotif] = useState("");

  // Pré-remplir avec le principal dès qu'il est connu
  useEffect(() => {
    if (!value && principal) onChange(principal.depot_id, null);
  }, [principal, value, onChange]);

  const isPrincipalSelected = !!principal && value === principal.depot_id;
  const selected = depots.find((d) => d.depot_id === value);
  const locked = disabled || (!unlocked && !canOverride) || (!unlocked && isPrincipalSelected);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          {label}
          {locked ? (
            <Lock className="h-3 w-3 text-muted-foreground" />
          ) : (
            <Unlock className="h-3 w-3 text-warning" />
          )}
        </Label>
        {canOverride &&
          !disabled &&
          (unlocked || !isPrincipalSelected ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                if (principal) onChange(principal.depot_id, null);
                setUnlocked(false);
                setMotif("");
              }}
            >
              Revenir au dépôt principal
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-warning hover:text-warning"
              onClick={() => setAskOpen(true)}
            >
              Autoriser un autre dépôt
            </Button>
          ))}
      </div>

      <Select
        value={value}
        onValueChange={(v) => onChange(v, unlocked ? motif || null : null)}
        disabled={locked}
      >
        <SelectTrigger className={locked ? "bg-muted" : ""}>
          <SelectValue placeholder={principal ? principal.nom : "Aucun dépôt principal défini"} />
        </SelectTrigger>
        <SelectContent>
          {depots
            .filter((d) => d.actif)
            .map((d) => (
              <SelectItem key={d.depot_id} value={d.depot_id}>
                {d.nom}
                {d.is_principal ? " — Principal" : ""}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>

      {locked && (
        <p className="text-xs text-muted-foreground">
          Les sorties de stock se font depuis le dépôt principal.
          {!canOverride && " Contactez un gestionnaire pour un déstockage exceptionnel."}
        </p>
      )}

      {unlocked && !isPrincipalSelected && selected && (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Déstockage exceptionnel — {selected.nom}</div>
            <div className="text-warning">Motif : {motif || "—"}</div>
          </div>
        </div>
      )}

      <Dialog open={askOpen} onOpenChange={setAskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Autoriser un déstockage exceptionnel</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Vous allez autoriser une sortie de stock depuis un dépôt autre que le dépôt principal.
            Cette opération sera enregistrée dans le journal d'audit.
          </p>
          <div className="space-y-1.5">
            <Label>Motif (obligatoire)</Label>
            <Textarea
              rows={3}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Ex. rupture sur le dépôt principal, livraison directe depuis la réserve…"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAskOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={!motif.trim()}
              onClick={() => {
                setUnlocked(true);
                setAskOpen(false);
              }}
            >
              Déverrouiller le champ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
