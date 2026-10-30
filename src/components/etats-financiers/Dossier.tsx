// Dossier annuel : génération d'une version figée, validation, réouverture et
// historique. Les droits et les règles (bloquants, données modifiées, version
// validée inaltérable) sont appliqués en base ; l'écran les reflète.

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, History, Lock, RefreshCw, Unlock } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveTable } from "@/components/layout/ResponsiveTable";
import { BadgeStatut } from "@/components/etats-financiers/Preparation";
import { usePermissions } from "@/hooks/use-permissions";
import {
  enregistrerDossier,
  rouvrirDossier,
  validerDossier,
} from "@/lib/etats-financiers/donnees-api";
import {
  obstaclesValidation,
  type ContenuDossier,
  type EtatDossier,
  type StatutDossier,
  type VersionDossier,
} from "@/lib/etats-financiers/dossiers";
import { formatDateTime } from "@/lib/format";
import { friendlyError } from "@/lib/friendly-error";

const STATUT: Record<StatutDossier, { libelle: string; classe: string }> = {
  brouillon: { libelle: "Brouillon", classe: "bg-secondary text-secondary-foreground" },
  remplace: { libelle: "Remplacé", classe: "bg-muted text-muted-foreground" },
  valide: { libelle: "Validé", classe: "bg-emerald-600 text-white" },
  devalide: { libelle: "Réouvert", classe: "bg-amber-500 text-white" },
};

export function BadgeDossier({ statut }: { statut: StatutDossier }) {
  return <Badge className={STATUT[statut].classe}>{STATUT[statut].libelle}</Badge>;
}

const SOURCE: Record<string, string> = {
  erp: "écritures de l'ERP",
  import: "balance importée",
  aucune: "aucune donnée",
};

export function PanneauDossier({
  etat,
  versions,
  contenuActuel,
  versionAffichee,
  onAfficher,
}: {
  etat: EtatDossier;
  versions: VersionDossier[];
  /** Dossier construit à partir des données actuelles (null tant qu'elles se chargent). */
  contenuActuel: ContenuDossier | null;
  /** Version figée affichée (null : données actuelles). */
  versionAffichee: string | null;
  onAfficher: (dossierId: string | null) => void;
}) {
  const { has } = usePermissions();
  const qc = useQueryClient();
  const [envoi, setEnvoi] = useState(false);
  const [saisie, setSaisie] = useState<{ action: "valider" | "rouvrir"; texte: string } | null>(
    null,
  );
  const [historique, setHistorique] = useState(false);
  const peutGenerer = has("exercices.modifier");
  const peutValider = has("exercices.cloturer");
  const obstacles = obstaclesValidation(etat);

  async function executer(action: () => Promise<unknown>, succes: string, refus: string) {
    setEnvoi(true);
    try {
      await action();
      toast.success(succes);
      setSaisie(null);
      await qc.invalidateQueries({ queryKey: ["etats-financiers-dossier"] });
    } catch (e) {
      toast.error(friendlyError(e, refus));
    } finally {
      setEnvoi(false);
    }
  }

  const generer = () =>
    contenuActuel &&
    executer(
      async () => {
        await enregistrerDossier(contenuActuel);
        onAfficher(null);
      },
      "États financiers générés : nouvelle version enregistrée.",
      "Génération refusée",
    );

  const v = etat.etape === "aucun" ? null : etat.version;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          Dossier annuel
          {v ? (
            <>
              <BadgeDossier statut={v.statut} />
              <span className="text-sm font-normal text-muted-foreground">version {v.version}</span>
            </>
          ) : (
            <span className="text-sm font-normal text-muted-foreground">non généré</span>
          )}
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          {peutGenerer && etat.etape !== "valide" && (
            <Button size="sm" onClick={generer} disabled={envoi || !contenuActuel}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {v ? "Régénérer" : "Générer les états financiers"}
            </Button>
          )}
          {peutValider && etat.etape === "brouillon" && !saisie && (
            <Button
              size="sm"
              variant="outline"
              disabled={envoi || obstacles.length > 0}
              onClick={() => setSaisie({ action: "valider", texte: "" })}
            >
              <Lock className="mr-2 h-4 w-4" /> Valider le dossier
            </Button>
          )}
          {peutValider && etat.etape === "valide" && !saisie && (
            <Button
              size="sm"
              variant="outline"
              disabled={envoi}
              onClick={() => setSaisie({ action: "rouvrir", texte: "" })}
            >
              <Unlock className="mr-2 h-4 w-4" /> Rouvrir
            </Button>
          )}
          {versions.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setHistorique(!historique)}>
              <History className="mr-2 h-4 w-4" /> Historique ({versions.length})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {v ? (
          <p>
            Généré le {formatDateTime(v.genere_le)}
            {v.genere_par_nom ? ` par ${v.genere_par_nom}` : ""} — source :{" "}
            {SOURCE[v.source] ?? v.source} — contrôles : <BadgeStatut statut={v.preparation} /> (
            {v.nb_bloquants} bloquant(s), {v.nb_avertissements} à vérifier).
            {v.valide_le && (
              <>
                <br />
                <CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-600" />
                Validé le {formatDateTime(v.valide_le)}
                {v.valide_par_nom ? ` par ${v.valide_par_nom}` : ""}
                {v.commentaire_validation ? ` : « ${v.commentaire_validation} »` : "."}
              </>
            )}
          </p>
        ) : (
          <p className="text-muted-foreground">
            Les états ci-dessous sont recalculés à chaque ouverture. Générer le dossier en
            enregistre une version datée, avec ses contrôles et les données utilisées.
          </p>
        )}

        {etat.etape !== "aucun" && etat.aJour === false && (
          <Alert variant={etat.etape === "valide" ? "destructive" : "default"}>
            <AlertTitle>Données comptables modifiées depuis la génération</AlertTitle>
            <AlertDescription>
              {etat.etape === "valide"
                ? "Le dossier validé reste affiché tel qu'il a été validé. Pour tenir compte des nouvelles écritures, le rouvrir (motif obligatoire) puis le régénérer."
                : "Régénérer le dossier avant de le valider."}
            </AlertDescription>
          </Alert>
        )}
        {etat.etape === "brouillon" && peutValider && obstacles.length > 0 && (
          <p className="text-muted-foreground">Validation impossible : {obstacles.join(" ")}</p>
        )}
        {etat.etape === "valide" && peutGenerer && (
          <p className="text-muted-foreground">
            Dossier validé : la régénération et l'import de balance sont bloqués tant qu'il n'est
            pas réouvert.
          </p>
        )}

        {saisie && v && (
          <div className="space-y-2 rounded-md border p-3">
            <Label htmlFor="dossier-texte">
              {saisie.action === "valider"
                ? "Commentaire de validation (facultatif)"
                : "Motif de la réouverture (obligatoire)"}
            </Label>
            <Textarea
              id="dossier-texte"
              value={saisie.texte}
              onChange={(e) => setSaisie({ ...saisie, texte: e.target.value })}
              rows={2}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={envoi || (saisie.action === "rouvrir" && saisie.texte.trim().length < 5)}
                onClick={() =>
                  saisie.action === "valider"
                    ? executer(
                        () => validerDossier(v.dossier_id, saisie.texte),
                        `Dossier version ${v.version} validé.`,
                        "Validation refusée",
                      )
                    : executer(
                        () => rouvrirDossier(v.dossier_id, saisie.texte),
                        "Dossier réouvert : la version validée reste conservée dans l'historique.",
                        "Réouverture refusée",
                      )
                }
              >
                {saisie.action === "valider"
                  ? "Confirmer la validation"
                  : "Confirmer la réouverture"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSaisie(null)}>
                Annuler
              </Button>
            </div>
          </div>
        )}

        {historique && (
          <HistoriqueDossier
            versions={versions}
            versionAffichee={versionAffichee}
            onAfficher={onAfficher}
          />
        )}
      </CardContent>
    </Card>
  );
}

function HistoriqueDossier({
  versions,
  versionAffichee,
  onAfficher,
}: {
  versions: VersionDossier[];
  versionAffichee: string | null;
  onAfficher: (dossierId: string | null) => void;
}) {
  return (
    <ResponsiveTable>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Version</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Générée</TableHead>
            <TableHead>Contrôles</TableHead>
            <TableHead>Validation / réouverture</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {versions.map((v) => (
            <TableRow key={v.dossier_id}>
              <TableCell className="font-mono">{v.version}</TableCell>
              <TableCell>
                <BadgeDossier statut={v.statut} />
              </TableCell>
              <TableCell>
                {formatDateTime(v.genere_le)}
                {v.genere_par_nom && (
                  <span className="block text-xs text-muted-foreground">{v.genere_par_nom}</span>
                )}
              </TableCell>
              <TableCell>
                <BadgeStatut statut={v.preparation} />
              </TableCell>
              <TableCell className="text-xs">
                {v.valide_le && (
                  <span className="block">
                    Validée le {formatDateTime(v.valide_le)}
                    {v.valide_par_nom ? ` par ${v.valide_par_nom}` : ""}
                  </span>
                )}
                {v.devalide_le && (
                  <span className="block">
                    Réouverte le {formatDateTime(v.devalide_le)}
                    {v.devalide_par_nom ? ` par ${v.devalide_par_nom}` : ""} :{" "}
                    {v.motif_devalidation}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {versionAffichee === v.dossier_id ? (
                  <Button size="sm" variant="ghost" onClick={() => onAfficher(null)}>
                    Données actuelles
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => onAfficher(v.dossier_id)}>
                    Consulter
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ResponsiveTable>
  );
}
