// Préparation du dossier d'états financiers : statut, contrôles classés,
// source des données (import de balance) et identification de l'entité.

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Info, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/hooks/use-permissions";
import type { Controle, Niveau, StatutPreparation } from "@/lib/etats-financiers/controles";
import {
  enregistrerIdentite,
  importerBalance,
  type EtatsExercice,
} from "@/lib/etats-financiers/donnees-api";
import { CHAMPS_IDENTITE, type ValeurIdentite } from "@/lib/etats-financiers/identite";
import { lireBalance, type ResultatImport } from "@/lib/etats-financiers/import-balance";
import { formatDate, formatFCFA } from "@/lib/format";
import { friendlyError } from "@/lib/friendly-error";

const STATUT: Record<StatutPreparation, { libelle: string; classe: string }> = {
  incomplet: { libelle: "Incomplet", classe: "bg-destructive text-destructive-foreground" },
  a_verifier: { libelle: "À vérifier", classe: "bg-amber-500 text-white" },
  pret: { libelle: "Prêt", classe: "bg-emerald-600 text-white" },
};

const NIVEAU: Record<Niveau, { libelle: string; icone: typeof Info; classe: string }> = {
  bloquant: { libelle: "Bloquant", icone: XCircle, classe: "text-destructive" },
  avertissement: { libelle: "À vérifier", icone: AlertTriangle, classe: "text-amber-600" },
  info: { libelle: "Info", icone: Info, classe: "text-muted-foreground" },
};

export function BadgeStatut({ statut }: { statut: StatutPreparation }) {
  return <Badge className={STATUT[statut].classe}>{STATUT[statut].libelle}</Badge>;
}

export function ListeControles({ controles }: { controles: Controle[] }) {
  const compte = (n: Niveau) => controles.filter((c) => c.niveau === n).length;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-3 text-base">
          Contrôles
          <span className="text-sm font-normal text-muted-foreground">
            {compte("bloquant")} bloquant(s) · {compte("avertissement")} à vérifier ·{" "}
            {compte("info")} info
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {controles.length === 0 ? (
          <p className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Aucun point relevé.
          </p>
        ) : (
          <ul className="space-y-2">
            {controles.map((c) => {
              const n = NIVEAU[c.niveau];
              const Icone = n.icone;
              return (
                <li key={c.code} className="flex gap-2 text-sm">
                  <Icone className={`mt-0.5 h-4 w-4 shrink-0 ${n.classe}`} aria-hidden />
                  <span>
                    <span className={`font-medium ${n.classe}`}>{n.libelle} : </span>
                    {c.message}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Source des données de l'exercice et import d'une balance (autre logiciel, historique). */
export function SourceDonnees({
  exerciceId,
  libelleExercice,
  etats,
}: {
  exerciceId: string;
  libelleExercice: string;
  etats: EtatsExercice;
}) {
  const { has } = usePermissions();
  const qc = useQueryClient();
  const fichierRef = useRef<HTMLInputElement>(null);
  const [lecture, setLecture] = useState<(ResultatImport & { fichier: string }) | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const { donnees, balanceImportee, completude } = etats;
  const peutImporter = has("exercices.modifier");

  async function lire(file: File) {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const feuille = wb.Sheets[wb.SheetNames[0]];
      const cellules = XLSX.utils.sheet_to_json<unknown[]>(feuille, {
        header: 1,
        raw: true,
        defval: "",
      });
      setLecture({ ...lireBalance(cellules), fichier: file.name });
    } catch (e) {
      toast.error(friendlyError(e, "Fichier illisible"));
    }
  }

  async function confirmer() {
    if (!lecture) return;
    setEnvoi(true);
    try {
      await importerBalance(exerciceId, lecture.fichier, lecture.lignes);
      toast.success(`Balance importée pour ${libelleExercice} (${lecture.lignes.length} comptes).`);
      setLecture(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["etats-financiers"] }),
        // L'empreinte des données change : le dossier généré n'est plus à jour.
        qc.invalidateQueries({ queryKey: ["etats-financiers-dossier"] }),
      ]);
    } catch (e) {
      toast.error(friendlyError(e, "Import refusé"));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Données comptables</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          Source utilisée :{" "}
          <strong>
            {donnees.source === "erp"
              ? "écritures de l'ERP"
              : donnees.source === "import"
                ? "balance importée"
                : "aucune"}
          </strong>
          {completude ? ` (${completude.ecritures_periode} écritures sur la période)` : ""}.
        </p>
        {balanceImportee && (
          <p className="text-muted-foreground">
            Balance importée le {formatDate(balanceImportee.importeLe)}
            {balanceImportee.fichier ? ` (${balanceImportee.fichier})` : ""} :{" "}
            {balanceImportee.lignes.length} comptes,{" "}
            {balanceImportee.avecMouvements ? "avec" : "sans"} mouvements de l'exercice
            {donnees.importIgnore ? ". Ignorée : l'ERP contient des écritures." : "."}
          </p>
        )}
        <p className="text-muted-foreground">
          Importer une balance sert pour un exercice tenu hors de l'ERP (colonne N-1, soldes
          d'ouverture du premier exercice). Les écritures de l'ERP restent prioritaires. Formats :
          Excel ou CSV avec une colonne « Compte » et des soldes débit / crédit ; une balance à 6
          colonnes (avec mouvements) rend le TFT exact.
        </p>
        {peutImporter && (
          <>
            <input
              ref={fichierRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void lire(f);
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" onClick={() => fichierRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              {balanceImportee ? "Remplacer la balance importée" : "Importer une balance"}
            </Button>
          </>
        )}
        {lecture && (
          <div className="space-y-2 rounded-md border p-3">
            <p>
              <strong>{lecture.fichier}</strong> : {lecture.lignes.length} comptes lus
              {lecture.avecMouvements ? ", avec mouvements" : ""}. Colonnes :{" "}
              {lecture.colonnes.join(", ") || "—"}.
            </p>
            <p>
              Soldes débiteurs{" "}
              {formatFCFA(lecture.lignes.reduce((s, l) => s + Math.max(l.solde, 0), 0))}, soldes
              créditeurs {formatFCFA(lecture.lignes.reduce((s, l) => s + Math.max(-l.solde, 0), 0))}
              .
            </p>
            {lecture.erreurs.length > 0 && (
              <ul className="list-disc pl-5 text-destructive">
                {lecture.erreurs.slice(0, 10).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={confirmer}
                disabled={envoi || lecture.erreurs.length > 0 || !lecture.lignes.length}
              >
                Importer pour {libelleExercice}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setLecture(null)}>
                Annuler
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Identification permanente de l'entité : saisie une fois, reprise chaque année. */
export function Identification({ identite }: { identite: Record<string, ValeurIdentite> }) {
  const { has } = usePermissions();
  const qc = useQueryClient();
  const [saisie, setSaisie] = useState<Record<string, string> | null>(null);
  const [envoi, setEnvoi] = useState(false);
  // Enregistrement réservé aux administrateurs (RLS de parametres_entreprise).
  const peutModifier = has("exercices.modifier");

  async function enregistrer() {
    if (!saisie) return;
    setEnvoi(true);
    try {
      // Seuls les champs modifiés (ou déjà propres à la liasse) sont enregistrés :
      // une valeur reprise des paramètres FNE continue d'en dépendre.
      const modifies = Object.fromEntries(
        Object.entries(saisie).filter(
          ([cle, v]) =>
            v.trim() !== (identite[cle]?.valeur ?? "") || identite[cle]?.origine === "liasse",
        ),
      );
      await enregistrerIdentite(modifies);
      toast.success("Identification enregistrée.");
      setSaisie(null);
      await qc.invalidateQueries({ queryKey: ["etats-financiers-identite"] });
    } catch (e) {
      toast.error(friendlyError(e, "Enregistrement refusé (réservé aux administrateurs)"));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base">Identification de l'entité</CardTitle>
        {peutModifier && !saisie && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setSaisie(
                Object.fromEntries(
                  CHAMPS_IDENTITE.map((c) => [c.cle, identite[c.cle]?.valeur ?? ""]),
                ),
              )
            }
          >
            Compléter
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {CHAMPS_IDENTITE.map((c) => {
            const v = identite[c.cle];
            return (
              <div key={c.cle} className="space-y-1">
                <Label htmlFor={`id-${c.cle}`} className="flex items-center gap-2">
                  {c.libelle}
                  {c.requis && <span className="text-destructive">*</span>}
                  {v?.origine === "fne" && !saisie && (
                    <span className="text-xs font-normal text-muted-foreground">
                      (paramètres FNE)
                    </span>
                  )}
                </Label>
                {saisie ? (
                  <Input
                    id={`id-${c.cle}`}
                    value={saisie[c.cle] ?? ""}
                    onChange={(e) => setSaisie({ ...saisie, [c.cle]: e.target.value })}
                  />
                ) : (
                  <p
                    className={`text-sm ${v?.valeur ? "" : c.requis ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {v?.valeur || (c.requis ? "À compléter" : "—")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {saisie && (
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={enregistrer} disabled={envoi}>
              Enregistrer
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSaisie(null)}>
              Annuler
            </Button>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Saisie une fois, reprise chaque année. Dates et durée de l'exercice viennent de l'exercice
          comptable sélectionné.
        </p>
      </CardContent>
    </Card>
  );
}
