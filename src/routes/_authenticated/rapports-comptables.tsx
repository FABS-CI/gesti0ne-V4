import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
import { ResponsiveTable } from "@/components/layout/ResponsiveTable";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { useExercice } from "@/contexts/ExerciceContext";
import { getTableauDeBordCompta, type TableauDeBordCompta } from "@/lib/compta-api";
import { exportCsv } from "@/lib/export-csv";
import { formatFCFA } from "@/lib/format";
import { friendlyError } from "@/lib/friendly-error";

export const Route = createFileRoute("/_authenticated/rapports-comptables")({
  component: RapportsComptablesPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const MOIS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];
const libelleMois = (m: string) => `${MOIS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

/** Montant d'un compte principal (ex. 60, 66) dans la répartition des charges. */
const charge = (t: TableauDeBordCompta, compte: string) =>
  t.charges_par_compte.find((c) => c.compte === compte)?.montant ?? 0;
const ratio = (a: number, b: number) => (b ? (a / b) * 100 : null);
const pct = (v: number | null) => (v == null ? "—" : `${v.toFixed(1).replace(".", ",")} %`);

type Ligne = {
  label: string;
  n: (t: TableauDeBordCompta) => number | null;
  format: "fcfa" | "pct";
  aide?: string;
};

// Indicateurs calculés uniquement à partir des écritures (aucune estimation).
const INDICATEURS: Ligne[] = [
  { label: "Chiffre d'affaires (70)", n: (t) => t.resultat.chiffre_affaires, format: "fcfa" },
  { label: "Produits (classe 7)", n: (t) => t.resultat.produits, format: "fcfa" },
  { label: "Achats et variations de stocks (60)", n: (t) => charge(t, "60"), format: "fcfa" },
  { label: "Charges de personnel (66)", n: (t) => charge(t, "66"), format: "fcfa" },
  { label: "Charges (classe 6)", n: (t) => t.resultat.charges, format: "fcfa" },
  { label: "Hors activités ordinaires (classe 8, net)", n: (t) => t.resultat.hao, format: "fcfa" },
  { label: "Résultat", n: (t) => t.resultat.resultat, format: "fcfa" },
  {
    label: "Marge sur achats / chiffre d'affaires",
    n: (t) => ratio(t.resultat.chiffre_affaires - charge(t, "60"), t.resultat.chiffre_affaires),
    format: "pct",
    aide: "(CA - comptes 60) / CA",
  },
  {
    label: "Charges de personnel / chiffre d'affaires",
    n: (t) => ratio(charge(t, "66"), t.resultat.chiffre_affaires),
    format: "pct",
  },
  {
    label: "Résultat / chiffre d'affaires",
    n: (t) => ratio(t.resultat.resultat, t.resultat.chiffre_affaires),
    format: "pct",
  },
  {
    label: "Trésorerie en fin de période (classe 5)",
    n: (t) => t.situation.tresorerie,
    format: "fcfa",
  },
  { label: "Créances clients (41)", n: (t) => t.situation.creances_clients, format: "fcfa" },
  { label: "Dettes fournisseurs (40)", n: (t) => t.situation.dettes_fournisseurs, format: "fcfa" },
];

const affiche = (v: number | null, format: Ligne["format"]) =>
  v == null ? "—" : format === "pct" ? pct(v) : formatFCFA(v);

function RapportsComptablesPage() {
  const { exercices, exerciceConsulteId } = useExercice();
  const [choix, setChoix] = useState<string | null>(null);
  const exerciceId = choix ?? exerciceConsulteId;
  const exercice = exercices.find((e) => e.exercice_id === exerciceId) ?? null;
  // Exercice précédent : le plus récent qui se termine avant le début de celui-ci.
  const precedent = useMemo(
    () =>
      exercice
        ? ([...exercices]
            .filter((e) => e.date_fin < exercice.date_debut)
            .sort((a, b) => b.date_fin.localeCompare(a.date_fin))[0] ?? null)
        : null,
    [exercices, exercice],
  );

  const qN = useQuery({
    queryKey: ["compta-dashboard", exerciceId],
    enabled: !!exerciceId,
    queryFn: () => getTableauDeBordCompta(exerciceId!),
  });
  const qN1 = useQuery({
    queryKey: ["compta-dashboard", precedent?.exercice_id],
    enabled: !!precedent,
    queryFn: () => getTableauDeBordCompta(precedent!.exercice_id),
  });
  const n = qN.data;
  const n1 = qN1.data;

  const cumuls = useMemo(() => {
    let c = 0;
    return (n?.mensuel ?? []).map((m) => (c += m.resultat));
  }, [n]);

  const exporter = () => {
    if (!n || !exercice) return;
    exportCsv(
      `rapport-comptable-${exercice.code}`,
      ["Mois", "Chiffre d'affaires", "Produits", "Charges", "Résultat", "Résultat cumulé"],
      n.mensuel.map((m, i) => [
        libelleMois(m.mois),
        formatFCFA(m.chiffre_affaires),
        formatFCFA(m.produits),
        formatFCFA(m.charges),
        formatFCFA(m.resultat),
        formatFCFA(cumuls[i]),
      ]),
      {
        pageTitle: `RAPPORT COMPTABLE — EXERCICE ${exercice.code}`,
        summary: INDICATEURS.map((l) => ({
          label: l.label,
          value:
            affiche(l.n(n), l.format) +
            (n1 && precedent ? ` (${precedent.code} : ${affiche(l.n(n1), l.format)})` : ""),
        })),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="ds-page-title flex items-center gap-2">
            <BarChart3 className="h-6 w-6" /> Rapports comptables
          </h1>
          <p className="text-sm text-muted-foreground">
            Synthèse mensuelle et indicateurs, comparés à l&apos;exercice précédent
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label>Exercice</Label>
            <Select value={exerciceId ?? undefined} onValueChange={setChoix}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Choisir" />
              </SelectTrigger>
              <SelectContent>
                {exercices.map((e) => (
                  <SelectItem key={e.exercice_id} value={e.exercice_id}>
                    {e.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={exporter} disabled={!n}>
            <FileText className="mr-2 h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {qN.error ? (
        <p className="text-sm text-destructive">
          {friendlyError(qN.error, "Rapport indisponible")}
        </p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Indicateurs {exercice?.code ?? ""}
                {precedent ? ` comparés à ${precedent.code}` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ResponsiveTable stickyFirstCol>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Indicateur</TableHead>
                      <TableHead className="text-right">{exercice?.code ?? "N"}</TableHead>
                      {precedent && <TableHead className="text-right">{precedent.code}</TableHead>}
                      {precedent && <TableHead className="text-right">Variation</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!n ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                          Calcul en cours…
                        </TableCell>
                      </TableRow>
                    ) : (
                      INDICATEURS.map((l) => {
                        const vN = l.n(n);
                        const vN1 = n1 ? l.n(n1) : null;
                        // Variation en % pour les montants, en points pour les ratios.
                        const variation =
                          vN == null || vN1 == null
                            ? "—"
                            : l.format === "pct"
                              ? `${vN - vN1 >= 0 ? "+" : ""}${(vN - vN1).toFixed(1).replace(".", ",")} pt`
                              : vN1
                                ? `${vN >= vN1 ? "+" : ""}${(((vN - vN1) / Math.abs(vN1)) * 100).toFixed(1).replace(".", ",")} %`
                                : "—";
                        return (
                          <TableRow key={l.label}>
                            <TableCell>
                              {l.label}
                              {l.aide && (
                                <span className="ml-1 text-xs text-muted-foreground">{l.aide}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {affiche(vN, l.format)}
                            </TableCell>
                            {precedent && (
                              <TableCell className="text-right">
                                {qN1.isLoading ? "…" : affiche(vN1, l.format)}
                              </TableCell>
                            )}
                            {precedent && (
                              <TableCell className="text-right text-muted-foreground">
                                {variation}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </ResponsiveTable>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Synthèse mensuelle</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ResponsiveTable stickyFirstCol>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mois</TableHead>
                      <TableHead className="text-right">Chiffre d&apos;affaires</TableHead>
                      <TableHead className="text-right">Produits</TableHead>
                      <TableHead className="text-right">Charges</TableHead>
                      <TableHead className="text-right">Résultat</TableHead>
                      <TableHead className="text-right">Résultat cumulé</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(n?.mensuel ?? []).map((m, i) => (
                      <TableRow key={m.mois}>
                        <TableCell>{libelleMois(m.mois)}</TableCell>
                        <TableCell className="text-right">
                          {formatFCFA(m.chiffre_affaires)}
                        </TableCell>
                        <TableCell className="text-right">{formatFCFA(m.produits)}</TableCell>
                        <TableCell className="text-right">{formatFCFA(m.charges)}</TableCell>
                        <TableCell
                          className={`text-right font-medium ${m.resultat < 0 ? "text-destructive" : ""}`}
                        >
                          {formatFCFA(m.resultat)}
                        </TableCell>
                        <TableCell
                          className={`text-right ${cumuls[i] < 0 ? "text-destructive" : ""}`}
                        >
                          {formatFCFA(cumuls[i])}
                        </TableCell>
                      </TableRow>
                    ))}
                    {n && (
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">
                          {formatFCFA(n.resultat.chiffre_affaires)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatFCFA(n.resultat.produits)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatFCFA(n.resultat.charges)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatFCFA(n.resultat.resultat)}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ResponsiveTable>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            Le résultat mensuel inclut les opérations hors activités ordinaires (classe 8) : le
            total de la colonne Résultat peut donc différer de « Produits - Charges ».
          </p>
        </>
      )}
    </div>
  );
}
