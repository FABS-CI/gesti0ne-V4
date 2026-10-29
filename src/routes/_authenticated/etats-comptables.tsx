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
import { exportCsv } from "@/lib/export-csv";
import { formatDate, formatFCFA } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/etats-comptables")({
  component: EtatsFinanciersPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const libelleExercice = (e: Exercice) =>
  e.code || `${formatDate(e.date_debut)} – ${formatDate(e.date_fin)}`;

async function chargerEtats(e: Exercice): Promise<EtatsFinanciers> {
  const [cumul, periode] = await Promise.all([
    getBalance(undefined, e.date_fin),
    getBalance(e.date_debut, e.date_fin),
  ]);
  return calculerEtatsFinanciers(cumul, periode);
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

  const exporter = (onglet: "actif" | "passif" | "resultat") => {
    if (!n || !exercice) return;
    const titre = {
      actif: "BILAN — ACTIF",
      passif: "BILAN — PASSIF",
      resultat: "COMPTE DE RÉSULTAT",
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
    const lignes = onglet === "passif" ? LIGNES_PASSIF : LIGNES_RESULTAT;
    const valeurs = (ef?: EtatsFinanciers) => (onglet === "passif" ? ef?.passif : ef?.resultat);
    exportCsv(
      `${onglet === "passif" ? "bilan-passif" : "compte-de-resultat"}-${nomN}`,
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
            Bilan et compte de résultat SYSCOHADA révisé (système normal), calculés depuis la
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

function Controles({ ef }: { ef: EtatsFinanciers }) {
  const { ecartBilan, ecartResultat } = ef.controles;
  const anomalies: string[] = [];
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
