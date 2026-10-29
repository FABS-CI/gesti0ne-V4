import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, Download, FileCode2, FileText } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveTable } from "@/components/layout/ResponsiveTable";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import {
  BadgeStatut,
  Identification,
  ListeControles,
  SourceDonnees,
} from "@/components/etats-financiers/Preparation";
import { useExercice, type Exercice } from "@/contexts/ExerciceContext";
import {
  LIGNES_ACTIF,
  LIGNES_PASSIF,
  LIGNES_RESULTAT,
  type EtatsFinanciers,
  type Ligne,
} from "@/lib/etats-financiers/syscohada";
import type { NoteCalculee } from "@/lib/etats-financiers/notes";
import { LIGNES_TFT } from "@/lib/etats-financiers/tft";
import {
  chargerExercice,
  exercicePrecedent,
  getIdentite,
  type EtatsExercice,
} from "@/lib/etats-financiers/donnees-api";
import { controler, statutPreparation, type Controle } from "@/lib/etats-financiers/controles";
import type { ValeurIdentite } from "@/lib/etats-financiers/identite";
import {
  genererXmlEdi,
  nccValide,
  nomFichierEdi,
  normaliserNcc,
} from "@/lib/etats-financiers/xml-edi";
import { exportCsv } from "@/lib/export-csv";
import { downloadBlob } from "@/lib/fec-helpers";
import { formatDate, formatFCFA } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/etats-comptables")({
  component: EtatsFinanciersPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const libelleExercice = (e: Exercice) =>
  e.code || `${formatDate(e.date_debut)} – ${formatDate(e.date_fin)}`;

const montant = (n: number | undefined) => (n ? formatFCFA(n, false) : "—");
const estTotal = (l: Ligne) => !!l.somme;

function EtatsFinanciersPage() {
  const { exercices, exerciceConsulte } = useExercice();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const exercice =
    exercices.find((e) => e.exercice_id === selectedId) ?? exerciceConsulte ?? exercices[0] ?? null;
  // N-1 : dernier exercice clos avant le début de N.
  const exerciceN1 = useMemo(
    () => (exercice ? exercicePrecedent(exercices, exercice) : null),
    [exercice, exercices],
  );

  const qN = useQuery({
    queryKey: ["etats-financiers", exercice?.exercice_id],
    queryFn: () => chargerExercice(exercice!, exerciceN1),
    enabled: !!exercice,
  });
  const qN1 = useQuery({
    queryKey: ["etats-financiers", exerciceN1?.exercice_id],
    queryFn: () => chargerExercice(exerciceN1!, exercicePrecedent(exercices, exerciceN1!)),
    enabled: !!exerciceN1,
  });
  const qIdentite = useQuery({ queryKey: ["etats-financiers-identite"], queryFn: getIdentite });
  const n = qN.data;
  // N-1 sans aucune donnée : colonne vide plutôt que des zéros trompeurs.
  const n1 = qN1.data?.donnees.source === "aucune" ? undefined : qN1.data;
  const identite = qIdentite.data;
  const controles = useMemo<Controle[] | null>(
    () =>
      n && exercice && identite
        ? controler({
            exercice,
            exerciceN1,
            donnees: n.donnees,
            ef: n,
            tft: n.tft,
            ouverture: n.ouvertureEf,
            efN1: n1 ?? null,
            completude: n.completude,
            identite,
          })
        : null,
    [n, n1, exercice, exerciceN1, identite],
  );

  const exporter = (onglet: "actif" | "passif" | "resultat" | "tft") => {
    if (!n || !exercice) return;
    const titre = {
      actif: "BILAN — ACTIF",
      passif: "BILAN — PASSIF",
      resultat: "COMPTE DE RÉSULTAT",
      tft: "TABLEAU DES FLUX DE TRÉSORERIE",
    }[onglet];
    const nomN = libelleExercice(exercice);
    const nomN1 = exerciceN1 ? libelleExercice(exerciceN1) : "N-1";
    if (onglet === "actif") {
      exportCsv(
        `bilan-actif-${nomN}`,
        ["Réf", "Actif", "Note", "Brut", "Amort. et dépréc.", `Net ${nomN}`, `Net ${nomN1}`],
        LIGNES_ACTIF.map((l) => [
          l.ref,
          l.libelle,
          l.note ?? "",
          montant(n.actif[l.ref].brut),
          montant(n.actif[l.ref].amort),
          montant(n.actif[l.ref].net),
          montant(n1?.actif[l.ref].net),
        ]),
        { pageTitle: `${titre} — ${nomN}` },
      );
      return;
    }
    const lignes = { passif: LIGNES_PASSIF, resultat: LIGNES_RESULTAT, tft: LIGNES_TFT }[onglet];
    const valeurs = (ef?: EtatsExercice) =>
      ({ passif: ef?.passif, resultat: ef?.resultat, tft: ef?.tft.valeurs })[onglet];
    const fichier = { passif: "bilan-passif", resultat: "compte-de-resultat", tft: "tft" }[onglet];
    exportCsv(
      `${fichier}-${nomN}`,
      ["Réf", "Libellé", "Note", nomN, nomN1],
      lignes.map((l) => [
        l.ref,
        l.libelle,
        l.note ?? "",
        montant(valeurs(n)?.[l.ref]),
        montant(valeurs(n1)?.[l.ref]),
      ]),
      { pageTitle: `${titre} — ${nomN}` },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="ds-page-title flex items-center gap-2">
            <FileText className="h-6 w-6" /> États financiers annuels — FABS-CI
          </h1>
          <p className="text-sm text-muted-foreground">
            Bilan, compte de résultat et TFT SYSCOHADA révisé (système normal), calculés depuis la
            balance
          </p>
        </div>
        <Select value={exercice?.exercice_id ?? ""} onValueChange={setSelectedId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Exercice" />
          </SelectTrigger>
          <SelectContent>
            {exercices.map((e) => (
              <SelectItem key={e.exercice_id} value={e.exercice_id}>
                {libelleExercice(e)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {qN.isError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Balance indisponible</AlertTitle>
          <AlertDescription>{(qN.error as Error).message}</AlertDescription>
        </Alert>
      )}
      {!exercice && <p className="text-muted-foreground">Aucun exercice comptable.</p>}
      {exercice && qN.isLoading && <p className="text-muted-foreground">Calcul des états…</p>}

      {n && exercice && (
        <>
          {controles && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              Dossier {libelleExercice(exercice)} :{" "}
              <BadgeStatut statut={statutPreparation(controles)} />
              <span className="text-muted-foreground">
                {controles.filter((c) => c.niveau === "bloquant").length} bloquant(s),{" "}
                {controles.filter((c) => c.niveau === "avertissement").length} point(s) à vérifier
              </span>
            </div>
          )}
          <Tabs defaultValue="preparation">
            <TabsList className="flex-wrap">
              <TabsTrigger value="preparation">Préparation</TabsTrigger>
              <TabsTrigger value="actif">Bilan actif</TabsTrigger>
              <TabsTrigger value="passif">Bilan passif</TabsTrigger>
              <TabsTrigger value="resultat">Compte de résultat</TabsTrigger>
              <TabsTrigger value="tft">TFT</TabsTrigger>
              <TabsTrigger value="notes">Notes annexes</TabsTrigger>
            </TabsList>
            <TabsContent value="preparation" className="space-y-4">
              {controles && <ListeControles controles={controles} />}
              <SourceDonnees
                exerciceId={exercice.exercice_id}
                libelleExercice={libelleExercice(exercice)}
                etats={n}
              />
              {exerciceN1 && qN1.data?.donnees.source === "aucune" && (
                <SourceDonnees
                  exerciceId={exerciceN1.exercice_id}
                  libelleExercice={`${libelleExercice(exerciceN1)} (N-1)`}
                  etats={qN1.data}
                />
              )}
              {identite && <Identification identite={identite} />}
              {identite && controles && (
                <ExportEdi
                  n={n}
                  n1={n1}
                  exercice={exercice}
                  identite={identite}
                  controles={controles}
                />
              )}
            </TabsContent>
            <TabsContent value="actif">
              <BoutonExport onClick={() => exporter("actif")} />
              <TableActif n={n} n1={n1} />
            </TabsContent>
            <TabsContent value="passif">
              <BoutonExport onClick={() => exporter("passif")} />
              <TableSimple lignes={LIGNES_PASSIF} n={n.passif} n1={n1?.passif} />
            </TabsContent>
            <TabsContent value="resultat">
              <BoutonExport onClick={() => exporter("resultat")} />
              <TableSimple lignes={LIGNES_RESULTAT} n={n.resultat} n1={n1?.resultat} />
            </TabsContent>
            <TabsContent value="tft">
              <BoutonExport onClick={() => exporter("tft")} />
              <TableSimple lignes={LIGNES_TFT} n={n.tft.valeurs} n1={n1?.tft.valeurs} />
            </TabsContent>
            <TabsContent value="notes">
              <NotesAnnexes
                notes={n.notes}
                notesN1={n1?.notes}
                nomN={libelleExercice(exercice)}
                nomN1={exerciceN1 ? libelleExercice(exerciceN1) : "N-1"}
              />
            </TabsContent>
          </Tabs>
          <p className="text-xs text-muted-foreground">
            Exercice N : {formatDate(exercice.date_debut)} au {formatDate(exercice.date_fin)}.{" "}
            {exerciceN1
              ? `Exercice N-1 : ${libelleExercice(exerciceN1)}.`
              : "Aucun exercice précédent : colonne N-1 vide."}
          </p>
        </>
      )}
    </div>
  );
}

function BoutonExport({ onClick }: { onClick: () => void }) {
  return (
    <div className="mb-2 flex justify-end">
      <Button variant="outline" size="sm" onClick={onClick}>
        <Download className="mr-2 h-4 w-4" /> PDF
      </Button>
    </div>
  );
}

function TableActif({ n, n1 }: { n: EtatsFinanciers; n1?: EtatsFinanciers }) {
  return (
    <Card>
      <CardContent className="p-0">
        <ResponsiveTable stickyFirstCol>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Réf</TableHead>
                <TableHead>Actif</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">Brut</TableHead>
                <TableHead className="text-right">Amort. et dépréc.</TableHead>
                <TableHead className="text-right">Net N</TableHead>
                <TableHead className="text-right">Net N-1</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {LIGNES_ACTIF.map((l) => (
                <TableRow
                  key={l.ref}
                  className={estTotal(l) ? "bg-muted/50 font-semibold" : undefined}
                >
                  <TableCell className="font-mono">{l.ref}</TableCell>
                  <TableCell>{l.libelle}</TableCell>
                  <TableCell>{l.note}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {montant(n.actif[l.ref].brut)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {montant(n.actif[l.ref].amort)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {montant(n.actif[l.ref].net)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {montant(n1?.actif[l.ref].net)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResponsiveTable>
      </CardContent>
    </Card>
  );
}

function TableSimple({
  lignes,
  n,
  n1,
}: {
  lignes: Ligne[];
  n: Record<string, number>;
  n1?: Record<string, number>;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <ResponsiveTable stickyFirstCol>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Réf</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">Exercice N</TableHead>
                <TableHead className="text-right">Exercice N-1</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lignes.map((l) => (
                <TableRow
                  key={l.ref}
                  className={estTotal(l) ? "bg-muted/50 font-semibold" : undefined}
                >
                  <TableCell className="font-mono">{l.ref}</TableCell>
                  <TableCell>{l.libelle}</TableCell>
                  <TableCell>{l.note}</TableCell>
                  <TableCell className="text-right tabular-nums">{montant(n[l.ref])}</TableCell>
                  <TableCell className="text-right tabular-nums">{montant(n1?.[l.ref])}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResponsiveTable>
      </CardContent>
    </Card>
  );
}

function NotesAnnexes({
  notes,
  notesN1,
  nomN,
  nomN1,
}: {
  notes: NoteCalculee[];
  notesN1?: NoteCalculee[];
  nomN: string;
  nomN1: string;
}) {
  const [numero, setNumero] = useState(notes[0]?.numero ?? "");
  const note = notes.find((n) => n.numero === numero) ?? notes[0];
  if (!note) return null;
  // N-1 rapproché par libellé : une ligne « non ventilé » peut n'exister qu'une année.
  const montantsN1 = new Map(
    notesN1?.find((n) => n.numero === note.numero)?.lignes.map((l) => [l.libelle, l.montant]),
  );
  const variation = (n: number, n1: number | undefined) =>
    n1 ? `${Math.round(((n - n1) / Math.abs(n1)) * 1000) / 10} %` : "";
  const titre = `NOTE ${note.numero} : ${note.titre.toUpperCase()}`;
  const lignes = note.lignes.map((l) => ({ ...l, n1: montantsN1.get(l.libelle) }));

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <Select value={note.numero} onValueChange={setNumero}>
          <SelectTrigger className="w-80">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {notes.map((n) => (
              <SelectItem key={n.numero} value={n.numero}>
                Note {n.numero} : {n.titre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            exportCsv(
              `note-${note.numero}-${nomN}`,
              ["Libellés", nomN, nomN1, "Variation"],
              lignes.map((l) => [
                l.libelle,
                montant(l.montant),
                montant(l.n1),
                variation(l.montant, l.n1),
              ]),
              { pageTitle: `${titre} — ${nomN}` },
            )
          }
        >
          <Download className="mr-2 h-4 w-4" /> PDF
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <ResponsiveTable stickyFirstCol>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{titre}</TableHead>
                  <TableHead className="text-right">Année N</TableHead>
                  <TableHead className="text-right">Année N-1</TableHead>
                  <TableHead className="text-right">Variation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lignes.map((l, i) => (
                  <TableRow
                    key={`${i}-${l.libelle}`}
                    className={l.niveau === "detail" ? undefined : "bg-muted/50 font-semibold"}
                  >
                    <TableCell>{l.libelle}</TableCell>
                    <TableCell className="text-right tabular-nums">{montant(l.montant)}</TableCell>
                    <TableCell className="text-right tabular-nums">{montant(l.n1)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {variation(l.montant, l.n1)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveTable>
        </CardContent>
      </Card>
      <p className="mt-2 text-xs text-muted-foreground">
        Notes calculées depuis les sous-comptes SYSCOHADA. Les autres notes (immobilisations,
        effectifs, échéances, engagements, commentaires) restent à compléter dans la liasse.
      </p>
    </>
  );
}

function ExportEdi({
  n,
  n1,
  exercice,
  identite,
  controles,
}: {
  n: EtatsExercice;
  n1?: EtatsExercice;
  exercice: Exercice;
  identite: Record<string, ValeurIdentite>;
  controles: Controle[];
}) {
  const ncc = identite.ncc?.valeur ?? "";
  const annee = exercice.date_fin.slice(0, 4);
  const bloquants = controles.filter((c) => c.niveau === "bloquant").length;

  const exporter = () => {
    const xml = genererXmlEdi({ ncc, exercice: annee, n, n1 });
    downloadBlob(new Blob([xml], { type: "application/xml" }), nomFichierEdi(ncc, annee));
  };

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 p-4">
        <Button onClick={exporter} disabled={!nccValide(ncc)}>
          <FileCode2 className="mr-2 h-4 w-4" /> Fichier XML e-impots {annee}
        </Button>
        <p className="basis-full text-xs text-muted-foreground">
          {!ncc
            ? "NCC manquant : compléter l'identification de l'entité."
            : !nccValide(ncc)
              ? `NCC invalide : « ${normaliserNcc(ncc)} » (format attendu 1234567A, sans espace).`
              : `NCC ${normaliserNcc(ncc)}. Contient le bilan, le compte de résultat et le TFT (N et N-1) ; les notes annexes et les fiches R restent à compléter sur e-impots.`}
          {bloquants
            ? ` Attention : ${bloquants} contrôle(s) bloquant(s), le fichier ne doit pas être déposé en l'état.`
            : ""}
        </p>
      </CardContent>
    </Card>
  );
}
