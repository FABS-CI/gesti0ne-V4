import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveTable } from "@/components/layout/ResponsiveTable";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { useExercice } from "@/contexts/ExerciceContext";
import { getBalance } from "@/lib/compta-api";
import { formatFCFA } from "@/lib/format";
import {
  anneePrecedente,
  libelleMois,
  moisDeLaPeriode,
  syntheseBalance,
  variation,
  type Synthese,
} from "@/lib/rapports-comptables";

export const Route = createFileRoute("/_authenticated/rapports-comptables")({
  head: () => ({
    meta: [
      { title: "Rapports comptables — FABS-CI" },
      { name: "description", content: "Produits, charges, marges, ratios et comparatifs issus des écritures comptables." },
      { property: "og:title", content: "Rapports comptables — FABS-CI" },
      { property: "og:description", content: "Produits, charges, marges, ratios et comparatifs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RapportsComptablesPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const fmtPct = (v: number | null) =>
  v === null ? "—" : `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`;

function Variation({ v, inverse = false }: { v: number | null; inverse?: boolean }) {
  if (v === null) return <span className="text-muted-foreground">—</span>;
  const bon = inverse ? v <= 0 : v >= 0;
  return (
    <span className={bon ? "text-success" : "text-destructive"}>
      {v > 0 ? "+" : ""}
      {fmtPct(v)}
    </span>
  );
}

function RapportsComptablesPage() {
  const { exerciceConsulte } = useExercice();
  const annee = new Date().getFullYear();
  const [debutSaisi, setDebut] = useState("");
  const [finSaisie, setFin] = useState("");
  const debut = debutSaisi || exerciceConsulte?.date_debut || `${annee}-01-01`;
  const fin = finSaisie || exerciceConsulte?.date_fin || `${annee}-12-31`;
  const valide = debut <= fin;

  const courant = useQuery({
    queryKey: ["rapports-comptables", "periode", debut, fin],
    queryFn: () => getBalance(debut, fin),
    enabled: valide,
  });
  const precedent = useQuery({
    queryKey: ["rapports-comptables", "periode", anneePrecedente(debut), anneePrecedente(fin)],
    queryFn: () => getBalance(anneePrecedente(debut), anneePrecedente(fin)),
    enabled: valide,
  });
  const mois = useMemo(() => (valide ? moisDeLaPeriode(debut, fin) : []), [debut, fin, valide]);
  const mensuel = useQuery({
    queryKey: ["rapports-comptables", "mensuel", debut, fin],
    queryFn: async () => {
      const res = await Promise.all(mois.map((m) => getBalance(m.from, m.to)));
      return mois.map((m, i) => ({ cle: m.cle, s: syntheseBalance(res[i]) }));
    },
    enabled: valide && mois.length > 0,
  });

  const s = courant.data ? syntheseBalance(courant.data) : null;
  const p = precedent.data ? syntheseBalance(precedent.data) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="ds-page-title">Rapports comptables</h1>
          <p className="text-sm text-muted-foreground">
            Calculés à partir des écritures comptables de la période
            {exerciceConsulte && !debutSaisi && !finSaisie ? ` (exercice ${exerciceConsulte.code})` : ""}.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="rc-debut">Du</Label>
            <Input id="rc-debut" type="date" value={debut} onChange={(e) => setDebut(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rc-fin">Au</Label>
            <Input id="rc-fin" type="date" value={fin} onChange={(e) => setFin(e.target.value)} className="w-40" />
          </div>
          {(debutSaisi || finSaisie) && (
            <Button variant="outline" size="sm" onClick={() => { setDebut(""); setFin(""); }}>
              Exercice en cours
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link to="/balance">Balance</Link>
          </Button>
        </div>
      </div>

      {!valide && <p className="text-sm text-destructive">La date de début doit précéder la date de fin.</p>}
      {courant.error && <p className="text-sm text-destructive">Impossible de charger les écritures de la période.</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi titre="Produits" valeur={s?.produits} prec={p?.produits} chargement={courant.isLoading} />
        <Kpi titre="Charges" valeur={s?.charges} prec={p?.charges} chargement={courant.isLoading} inverse />
        <Kpi titre="Résultat" valeur={s?.resultat} prec={p?.resultat} chargement={courant.isLoading} />
        <Kpi titre="Marge brute" valeur={s?.margeBrute} prec={p?.margeBrute} chargement={courant.isLoading} />
      </div>

      <Tabs defaultValue="ventilation">
        <TabsList>
          <TabsTrigger value="ventilation">Produits / charges</TabsTrigger>
          <TabsTrigger value="ratios">Ratios</TabsTrigger>
          <TabsTrigger value="mensuel">Synthèse mensuelle</TabsTrigger>
          <TabsTrigger value="comparatif">Comparatif N / N-1</TabsTrigger>
        </TabsList>

        <TabsContent value="ventilation" className="mt-4">
          {s && <Ventilation s={s} />}
        </TabsContent>

        <TabsContent value="ratios" className="mt-4">
          {s && <Ratios s={s} p={p} />}
        </TabsContent>

        <TabsContent value="mensuel" className="mt-4 space-y-4">
          {mensuel.isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
          {mensuel.data && <Mensuel lignes={mensuel.data} />}
        </TabsContent>

        <TabsContent value="comparatif" className="mt-4">
          {s && p && <Comparatif s={s} p={p} debut={debut} fin={fin} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({
  titre,
  valeur,
  prec,
  chargement,
  inverse,
}: {
  titre: string;
  valeur?: number;
  prec?: number;
  chargement: boolean;
  inverse?: boolean;
}) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <p className="text-sm text-muted-foreground">{titre}</p>
        <p className="text-xl font-semibold tabular-nums">
          {chargement || valeur === undefined ? "…" : formatFCFA(valeur)}
        </p>
        <p className="text-xs text-muted-foreground">
          vs N-1 : {valeur !== undefined && prec !== undefined ? <Variation v={variation(valeur, prec)} inverse={inverse} /> : "—"}
        </p>
      </CardContent>
    </Card>
  );
}

function Ventilation({ s }: { s: Synthese }) {
  const blocs = [
    { titre: "Produits", nature: "produit" as const, total: s.produits },
    { titre: "Charges", nature: "charge" as const, total: s.charges },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {blocs.map((b) => (
        <Card key={b.titre}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{b.titre}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveTable>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rubrique</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead className="text-right">Part</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {s.rubriques
                    .filter((r) => r.nature === b.nature && r.montant !== 0)
                    .map((r) => (
                      <TableRow key={r.code}>
                        <TableCell>
                          <span className="mr-2 font-mono text-xs text-muted-foreground">{r.code.replace(/[PC]$/, "")}</span>
                          {r.libelle}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatFCFA(r.montant)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtPct(b.total ? (r.montant / b.total) * 100 : null)}
                        </TableCell>
                      </TableRow>
                    ))}
                  <TableRow className="font-semibold">
                    <TableCell>Total {b.titre.toLowerCase()}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatFCFA(b.total)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </ResponsiveTable>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Ratios({ s, p }: { s: Synthese; p: Synthese | null }) {
  const lignes: { libelle: string; v: number | null; pv: number | null | undefined; aide: string }[] = [
    { libelle: "Taux de marge brute", v: s.tauxMargeBrute, pv: p?.tauxMargeBrute, aide: "(Ventes − achats) / ventes" },
    { libelle: "Taux de marge nette", v: s.tauxMargeNette, pv: p?.tauxMargeNette, aide: "Résultat / ventes" },
    { libelle: "Poids des achats", v: s.poidsAchats, pv: p?.poidsAchats, aide: "Achats (60) / ventes" },
    { libelle: "Poids du personnel", v: s.poidsPersonnel, pv: p?.poidsPersonnel, aide: "Charges de personnel (66) / ventes" },
  ];
  return (
    <Card>
      <CardContent className="pt-4">
        <ResponsiveTable>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Indicateur</TableHead>
                <TableHead>Calcul</TableHead>
                <TableHead className="text-right">Période</TableHead>
                <TableHead className="text-right">N-1</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Chiffre d'affaires</TableCell>
                <TableCell className="text-muted-foreground">Ventes (70)</TableCell>
                <TableCell className="text-right tabular-nums">{formatFCFA(s.chiffreAffaires)}</TableCell>
                <TableCell className="text-right tabular-nums">{p ? formatFCFA(p.chiffreAffaires) : "—"}</TableCell>
              </TableRow>
              {lignes.map((l) => (
                <TableRow key={l.libelle}>
                  <TableCell>{l.libelle}</TableCell>
                  <TableCell className="text-muted-foreground">{l.aide}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPct(l.v)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPct(l.pv ?? null)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResponsiveTable>
      </CardContent>
    </Card>
  );
}

function Mensuel({ lignes }: { lignes: { cle: string; s: Synthese }[] }) {
  const data = lignes.map((l) => ({
    mois: libelleMois(l.cle),
    Produits: Math.round(l.s.produits),
    Charges: Math.round(l.s.charges),
  }));
  const tot = lignes.reduce(
    (a, l) => ({ p: a.p + l.s.produits, c: a.c + l.s.charges, r: a.r + l.s.resultat }),
    { p: 0, c: 0, r: 0 },
  );
  return (
    <>
      <Card>
        <CardContent className="h-72 pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="mois" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="var(--muted-foreground)"
                tickFormatter={(v: number) => `${Math.round(v / 1_000_000)} M`}
              />
              <Tooltip formatter={(v: number) => formatFCFA(v)} />
              <Legend />
              <Bar dataKey="Produits" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Charges" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <ResponsiveTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mois</TableHead>
                  <TableHead className="text-right">Produits</TableHead>
                  <TableHead className="text-right">Charges</TableHead>
                  <TableHead className="text-right">Résultat</TableHead>
                  <TableHead className="text-right">Marge nette</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lignes.map((l) => (
                  <TableRow key={l.cle}>
                    <TableCell>{libelleMois(l.cle)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatFCFA(l.s.produits)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatFCFA(l.s.charges)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${l.s.resultat < 0 ? "text-destructive" : ""}`}>
                      {formatFCFA(l.s.resultat)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtPct(l.s.tauxMargeNette)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{formatFCFA(tot.p)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatFCFA(tot.c)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatFCFA(tot.r)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </ResponsiveTable>
        </CardContent>
      </Card>
    </>
  );
}

function Comparatif({ s, p, debut, fin }: { s: Synthese; p: Synthese; debut: string; fin: string }) {
  const fmtD = (d: string) => d.split("-").reverse().join("/");
  const lignes = [
    { libelle: "Chiffre d'affaires", a: s.chiffreAffaires, b: p.chiffreAffaires },
    { libelle: "Total produits", a: s.produits, b: p.produits },
    { libelle: "Achats", a: s.achats, b: p.achats, inverse: true },
    { libelle: "Charges de personnel", a: s.personnel, b: p.personnel, inverse: true },
    { libelle: "Total charges", a: s.charges, b: p.charges, inverse: true },
    { libelle: "Marge brute", a: s.margeBrute, b: p.margeBrute },
    { libelle: "Résultat", a: s.resultat, b: p.resultat },
  ];
  return (
    <Card>
      <CardContent className="pt-4">
        <ResponsiveTable>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Poste</TableHead>
                <TableHead className="text-right">
                  {fmtD(debut)} – {fmtD(fin)}
                </TableHead>
                <TableHead className="text-right">
                  {fmtD(anneePrecedente(debut))} – {fmtD(anneePrecedente(fin))}
                </TableHead>
                <TableHead className="text-right">Écart</TableHead>
                <TableHead className="text-right">Variation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lignes.map((l) => (
                <TableRow key={l.libelle}>
                  <TableCell>{l.libelle}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatFCFA(l.a)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatFCFA(l.b)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatFCFA(l.a - l.b)}</TableCell>
                  <TableCell className="text-right">
                    <Variation v={variation(l.a, l.b)} inverse={l.inverse} />
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
