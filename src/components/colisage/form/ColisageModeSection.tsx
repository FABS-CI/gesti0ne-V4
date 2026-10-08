import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { ModeAcheminement } from "@/lib/colisage-api";

type Detection = {
  villeEff: string;
  communeEff: string;
  autoMode: ModeAcheminement | null;
  raison: string;
};

export function ColisageModeSection({
  mode,
  onModeChange,
  detection,
  modeManuel,
}: {
  mode: ModeAcheminement;
  onModeChange: (m: ModeAcheminement) => void;
  detection: Detection;
  modeManuel: boolean;
}) {
  const { autoMode } = detection;
  return (
    <div className="md:col-span-3">
      <Label className="mb-2 block">Mode d'acheminement *</Label>
      <RadioGroup
        value={mode}
        onValueChange={(v) => onModeChange(v as ModeAcheminement)}
        className="flex gap-6"
      >
        <label className="flex items-center gap-2 cursor-pointer">
          <RadioGroupItem value="livraison" /> Livraison
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <RadioGroupItem value="expedition" /> Expédition
        </label>
      </RadioGroup>
      <div className="mt-2 rounded-md border bg-muted/40 px-3 py-2 text-xs">
        <div>
          <span className="text-muted-foreground">Ville détectée&nbsp;:</span>{" "}
          <strong>{detection.villeEff || "—"}</strong>
          {" · "}
          <span className="text-muted-foreground">Commune&nbsp;:</span>{" "}
          <strong>{detection.communeEff || "—"}</strong>
        </div>
        <div>
          <span className="text-muted-foreground">Mode suggéré&nbsp;:</span>{" "}
          <strong>
            {autoMode === "livraison"
              ? "Livraison directe"
              : autoMode === "expedition"
                ? "Expédition"
                : "—"}
          </strong>{" "}
          <span className="text-muted-foreground">({detection.raison})</span>
        </div>
        {modeManuel && autoMode && mode !== autoMode && (
          <div className="mt-1 text-warning">
            Mode forcé manuellement — sera recalculé si vous modifiez la ville ou la commune.
          </div>
        )}
      </div>
    </div>
  );
}
