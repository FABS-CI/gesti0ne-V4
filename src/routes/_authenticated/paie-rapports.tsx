import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Money } from "@/components/common/Money";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { authRouteHead } from "@/lib/route-head";

export const Route = createFileRoute("/_authenticated/paie-rapports")({
  head: () => authRouteHead("Rapports de paie"),
  component: RapportsPaiePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
type Tot = { n: number; brut: number; cotis: number; ret: number; net: number; cout: number };
const zero = (): Tot => ({ n: 0, brut: 0, cotis: 0, ret: 0, net: 0, cout: 0 });
const num = (v: unknown) => Number(v) || 0;

function RapportsPaiePage() {
  const [annee, setAnnee] = useState(String(new Date().getFullYear()));

  const { data: bulletins, isLoading } = useQuery({
    queryKey: ["paie-rapports-bulletins"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bulletins_paie")
        .select("bulletin_id, employe_id, employe_nom, date_debut, date_fin, date_bulletin, created_at, statut, salaire_brut, brut_imposable, cotisations, retenues, net_a_payer, salaire_net, cout_salarial")
        .limit(5000);
      if (error) throw error;
      return (data ?? []).filter((b) => !/annul/i.test(b.statut ?? ""));
    },
  });

  const rows = useMemo(
    () =>
      (bulletins ?? []).map((b) => {
        const d = new Date(b.date_fin ?? b.date_debut ?? b.date_bulletin ?? b.created_at);
        return { ...b, y: d.getFullYear(), m: d.getMonth() };
      }),
    [bulletins],
  );
  const annees = useMemo(() => {
    const s = new Set(rows.map((r) => String(r.y)));
    s.add(String(new Date().getFullYear()));
    return [...s].sort().reverse();
  }, [rows]);
  const sel = rows.filter((r) => String(r.y) === annee);
  const ids = sel.map((r) => r.bulletin_id);

  const { data: lignes } = useQuery({
    queryKey: ["paie-rapports-lignes", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const out: { bulletin_id: string; code: string | null; numero_rubrique: string | null; libelle: string | null; designation: string | null; gain: number; retenue: number }[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const { data, error } = await supabase
          .from("bulletin_lignes")
          .select("bulletin_id, code, numero_rubrique, libelle, designation, gain, retenue")
          .in("bulletin_id", ids.slice(i, i + 200));
        if (error) throw error;
        out.push(...(data ?? []));
      }
      return out;
    },
  });

  const add = (t: Tot, b: (typeof sel)[number]) => {
    t.n++;
    t.brut += num(b.brut_imposable ?? b.salaire_brut);
    t.cotis += num(b.cotisations);
    t.ret += num(b.retenues);
    t.net += num(b.net_a_payer ?? b.salaire_net);
    t.cout += num(b.cout_salarial);
  };
  const total = zero();
  const parMois = MOIS.map(zero);
  const parEmp = new Map<string, Tot & { nom: string }>();
  for (const b of sel) {
    add(total, b);
    add(parMois[b.m], b);
    const k = b.employe_id ?? b.employe_nom ?? "?";
    if (!parEmp.has(k)) parEmp.set(k, { ...zero(), nom: b.employe_nom ?? "—" });
    add(parEmp.get(k)!, b);
  }
  const emps = [...parEmp.values()].sort((a, b) => b.brut - a.brut);

  const rubs = useMemo(() => {
    const m = new Map<string, { code: string; libelle: string; gain: number; retenue: number }>();
    for (const l of lignes ?? []) {
      const lib = l.libelle ?? l.designation ?? "—";
      const k = (l.numero_rubrique ?? l.code ?? "") + "|" + lib;
      if (!m.has(k)) m.set(k, { code: l.numero_rubrique ?? l.code ?? "", libelle: lib, gain: 0, retenue: 0 });
      const r = m.get(k)!;
      r.gain += num(l.gain);
      r.retenue += num(l.retenue);
    }
    return [...m.values()].filter((r) => r.gain || r.retenue).sort((a, b) => a.code.localeCompare(b.code, "fr", { numeric: true }));
  }, [lignes]);

  const kpis: [string, number][] = [
    ["Masse salariale brute", total.brut],
    ["Cotisations", total.cotis],
    ["Total retenues", total.ret],
    ["Net versé", total.net],
    ["Coût employeur", total.cout],
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <BarChart3 className="h-6 w-6 text-primary" />
        <div className="flex-1">
          <h1 className="ds-page-title">Rapports de paie</h1>
          <p className="text-sm text-muted-foreground">Calculés à partir des bulletins enregistrés (hors bulletins annulés)</p>
        </div>
        <Select value={annee} onValueChange={setAnnee}>
          <SelectTrigger className="w-32" aria-label="Année"><SelectValue /></SelectTrigger>
          <SelectContent>{annees.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {isLoading ? <Skeleton className="h-64 w-full" /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground">Bulletins</div><div className="text-lg font-semibold tabular-nums">{total.n}</div></div>
            {kpis.map(([l, v]) => (
              <div key={l} className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground">{l}</div><Money value={v} className="text-lg font-semibold" /></div>
            ))}
          </div>

          <Section title={`Masse salariale mensuelle ${annee}`}>
            <Table>
              <TableHeader><TableRow><TableHead>Mois</TableHead><TableHead className="text-right">Bulletins</TableHead><TableHead className="text-right">Brut</TableHead><TableHead className="text-right">Cotisations</TableHead><TableHead className="text-right">Retenues</TableHead><TableHead className="text-right">Net</TableHead><TableHead className="text-right">Coût employeur</TableHead></TableRow></TableHeader>
              <TableBody>{parMois.map((t, i) => t.n === 0 ? null : <TotRow key={i} label={MOIS[i]} t={t} />)}</TableBody>
              <TableFooter><TotRow label="Total annuel" t={total} /></TableFooter>
            </Table>
          </Section>

          <Section title="Par employé">
            <Table>
              <TableHeader><TableRow><TableHead>Employé</TableHead><TableHead className="text-right">Bulletins</TableHead><TableHead className="text-right">Brut</TableHead><TableHead className="text-right">Cotisations</TableHead><TableHead className="text-right">Retenues</TableHead><TableHead className="text-right">Net</TableHead><TableHead className="text-right">Coût employeur</TableHead></TableRow></TableHeader>
              <TableBody>{emps.map((e, i) => <TotRow key={i} label={e.nom} t={e} />)}</TableBody>
            </Table>
          </Section>

          <Section title="Par rubrique">
            <Table>
              <TableHeader><TableRow><TableHead>N°</TableHead><TableHead>Rubrique</TableHead><TableHead className="text-right">Gains</TableHead><TableHead className="text-right">Retenues</TableHead></TableRow></TableHeader>
              <TableBody>{rubs.map((r, i) => (
                <TableRow key={i}><TableCell className="tabular-nums">{r.code}</TableCell><TableCell>{r.libelle}</TableCell><TableCell className="text-right"><Money value={r.gain} /></TableCell><TableCell className="text-right"><Money value={r.retenue} /></TableCell></TableRow>
              ))}</TableBody>
            </Table>
          </Section>
          {total.n === 0 && <p className="text-sm text-muted-foreground">Aucun bulletin pour {annee}.</p>}
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-lg border bg-card"><h2 className="px-4 pt-3 text-sm font-semibold">{title}</h2><div className="overflow-x-auto">{children}</div></section>;
}

function TotRow({ label, t }: { label: string; t: Tot }) {
  return (
    <TableRow>
      <TableCell>{label}</TableCell>
      <TableCell className="text-right tabular-nums">{t.n}</TableCell>
      <TableCell className="text-right"><Money value={t.brut} /></TableCell>
      <TableCell className="text-right"><Money value={t.cotis} /></TableCell>
      <TableCell className="text-right"><Money value={t.ret} /></TableCell>
      <TableCell className="text-right"><Money value={t.net} /></TableCell>
      <TableCell className="text-right"><Money value={t.cout} /></TableCell>
    </TableRow>
  );
}
