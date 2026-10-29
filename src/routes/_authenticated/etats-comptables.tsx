import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileText } from "lucide-react";

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
import { useExercice, type Exercice } from "@/contexts/ExerciceContext";
import { getBalance } from "@/lib/compta-api";
import {
  calculerEtatsFinanciers,
  LIGNES_ACTIF,
  LIGNES_PASSIF,
  LIGNES_RESULTAT,
  type EtatsFinanciers,
  type Ligne,
} from "@/lib/etats-financiers/syscohada";
import { calculerNotes, type NoteCalculee } from "@/lib/etats-financiers/notes";
import { calculerTft, LIGNES_TFT, type Tft } from "@/lib/etats-financiers/tft";
import { exportCsv } from "@/lib/export-csv";
import { formatDate, formatFCFA } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/etats-comptables")({
  component: EtatsFinanciersPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const libelleExercice = (e: Exercice) =>
  e.code || `${formatDate(e.date_debut)} – ${formatDate(e.date_fin)}`;

type EtatsExercice = EtatsFinanciers & { tft: Tft; notes: NoteCalculee[] };

/** Veille d'une date ISO (AAAA-MM-JJ). */
function veille(date: string): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function chargerEtats(e: Exercice): Promise<EtatsExercice> {
  const [ouverture, cumul, periode] = await Promise.all([
    getBalance(undefined, veille(e.date_debut)),
    getBalance(undefined, e.date_fin),
    getBalance(e.date_debut, e.date_fin),
  ]);
  const cloture = calculerEtatsFinanciers(cumul, periode);
  const tft = calculerTft(calculerEtatsFinanciers(ouverture, []), cloture, periode);
  return { ...cloture, tft, notes: calculerNotes(cumul, periode) };
}

const montant = (n: number | undefined) => (n ? formatFCFA(n, false) : "—");
const estTotal = (l: Ligne) => !!l.somme;

function EtatsFinanciersPage() {
  const { exercices, exerciceConsulte } = useExercice();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const exercice =
    exercices.find((e) => e.exercice_id === selectedId) ?? exerciceConsulte ?? exercices[0] ?? null;
  // N-1 : dernier exercice clos avant le début de N.
  const exerciceN1 = useMemo(
    () =>
      exercice
        ? (exercices
            .filter((e) => e.date_fin < exercice.date_debut)
            .sort((a, b) => b.date_fin.localeCompare(a.date_fin))[0] ?? null)
        : null,
    [exercice, exercices],
  );

  const qN = useQuery({
    queryKey: ["etats-financiers", exercice?.exercice_id],
    queryFn: () => chargerEtats(exercice!),
    enabled: !!exercice,
  });
  const qN1 = useQuery({
    queryKey: ["etats-financiers", exerciceN1?.exercice_id],
    queryFn: () => chargerEtats(exerciceN1!),
    enabled: !!exerciceN1,
  });
  const n = qN.data;
  const n1 = qN1.data;

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
            <FileText className="h-6 w-6" /> États financiers
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
          <Controles ef={n} />
          <Tabs defaultValue="actif">
            <TabsList>
              <TabsTrigger value="actif">Bilan actif</TabsTrigger>
              <TabsTrigger value="passif">Bilan passif</TabsTrigger>
              <TabsTrigger value="resultat">Compte de résultat</TabsTrigger>
              <TabsTrigger value="tft">TFT</TabsTrigger>
              <TabsTrigger value="notes">Notes annexes</TabsTrigger>
            </TabsList>
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

function Controles({ ef }: { ef: EtatsExercice }) {
  const { ecartBilan, ecartResultat } = ef.controles;
  const anomalies: string[] = [];
  if (ef.tft.ecartTresorerie)
    anomalies.push(
      `TFT : la trésorerie de clôture calculée diffère du bilan de ${formatFCFA(ef.tft.ecartTresorerie)} (écart de réévaluation ou de conversion ?).`,
    );
  if (ecartBilan)
    anomalies.push(`Bilan déséquilibré : actif − passif = ${formatFCFA(ecartBilan)}.`);
  if (ecartResultat)
    anomalies.push(
      `Le résultat au bilan diffère du compte de résultat de ${formatFCFA(ecartResultat)} (compte 13 déjà mouvementé ?).`,
    );
  if (ef.resultatAnterieurNonAffecte)
    anomalies.push(
      `${formatFCFA(ef.resultatAnterieurNonAffecte)} de résultats d'exercices antérieurs n'ont pas été affectés en écritures : ajoutés au report à nouveau (CH).`,
    );
  if (ef.comptesNonClasses.length)
    anomalies.push(
      `Comptes non classés : ${ef.comptesNonClasses
        .map((c) => `${c.compte} (${formatFCFA(c.solde)})`)
        .join(", ")}.`,
    );

  if (!anomalies.length)
    return (
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Contrôles OK</AlertTitle>
        <AlertDescription>
          Bilan équilibré, résultat cohérent, tous les comptes sont classés.
        </AlertDescription>
      </Alert>
    );
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Points à vérifier avant dépôt</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4">
          {anomalies.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
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
