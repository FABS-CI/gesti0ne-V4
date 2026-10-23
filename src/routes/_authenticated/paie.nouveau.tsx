import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { avertissementPeriode } from "@/lib/paie/periode-avertissement";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { listEmployes, type Employe } from "@/lib/rh-api";
import { Badge } from "@/components/ui/badge";
import type { CalculBulletin, LigneServeur } from "@/lib/paie/calcul-serveur";
import { formatNumber } from "@/lib/format";
import { RhPageHeader } from "@/components/rh/RhPageHeader";
import { useSaveHotkey } from "@/hooks/use-save-hotkey";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";

export const Route = createFileRoute("/_authenticated/paie/nouveau")({
  head: () => ({ meta: [{ title: "Nouveau bulletin de paie — GESTI-ONE" }] }),
  component: NouveauBulletinPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const MODES = ["Virement", "Espèces", "Chèque", "Mobile money"];

function moisCourant() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const iso = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  return { debut: iso(new Date(y, m, 1)), fin: iso(new Date(y, m + 1, 0)) };
}

const fmt = (n: number | null | undefined) => (n ? formatNumber(n) : "");

function NumField({ label, value, onChange, step, source }: { label: string; value: number; onChange: (n: number) => void; step?: number; source?: string }) {
  return (
    <div className="space-y-1">
      <Label className="flex items-center gap-1 text-xs">{label}{source && <Badge variant="outline" className="px-1 py-0 text-[10px] font-normal">{source}</Badge>}</Label>
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        step={step ?? 1}
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}

function NouveauBulletinPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const init = moisCourant();

  const [employeId, setEmployeId] = useState("");
  const [dateDebut, setDateDebut] = useState(init.debut);
  const [dateFin, setDateFin] = useState(init.fin);
  const [ov, setOv] = useState<Record<string, number>>({});
  const setO = (k: string) => (n: number) => setOv((o) => ({ ...o, [k]: n }));
  const [datePaiement, setDatePaiement] = useState("");
  const [modePaiement, setModePaiement] = useState("Virement");

  const { data: employes } = useQuery({ queryKey: ["employes-list"], queryFn: () => listEmployes() });
  const employe: Employe | undefined = useMemo(
    () => employes?.find((e) => e.employe_id === employeId),
    [employes, employeId],
  );

  const onSelectEmploye = (id: string) => {
    setEmployeId(id);
    setOv({});
    const emp = employes?.find((e) => e.employe_id === id);
    if (emp?.mode_paiement) setModePaiement(emp.mode_paiement);
  };

  const avertissement = avertissementPeriode(dateDebut, datePaiement, new Date().toISOString().slice(0, 10));
  const regimeCode = (dateFin || init.fin) < "2024-01-01" ? "REGIME_2022" : "REGIME_2024";
  const saisie = useMemo(() => ({ ...ov }), [ov]);
  const periodeOk = !!dateDebut && !!dateFin && dateFin >= dateDebut;
  const { data: calc, error: calcError, isFetching } = useQuery({
    queryKey: ["paie_calculer_bulletin", employeId, dateDebut, dateFin, saisie],
    enabled: !!employeId && periodeOk,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("paie_calculer_bulletin", {
        p_employe_id: employeId, p_date_debut: dateDebut, p_date_fin: dateFin, p_saisie: saisie,
      });
      if (error) throw error;
      return data as unknown as CalculBulletin;
    },
  });
  const val = (k: keyof CalculBulletin & string) => ov[k] ?? Number(calc?.[k] ?? 0);
  const src = (k: string) => (k in ov ? "Saisie manuelle" : calc?.sources?.[k]);

  const save = useMutation({
    mutationFn: async () => {
      if (!employe) throw new Error("Sélectionnez un employé");
      if (!dateDebut || !dateFin || dateFin < dateDebut) throw new Error("Période invalide");
      const { data, error } = await supabase.rpc("paie_enregistrer_bulletin", {
        p_employe_id: employe.employe_id,
        p_date_debut: dateDebut,
        p_date_fin: dateFin,
        p_saisie: {
          ...saisie,
          date_paiement: datePaiement || null,
          mode_paiement: modePaiement,
        },
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["bulletins_paie"] });
      toast.success("Bulletin enregistré");
      navigate({ to: "/paie/$bulletinId", params: { bulletinId: id } });
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  useSaveHotkey(() => save.mutate(), { enabled: !save.isPending && !!employe });

  const lignes = (calc?.lignes ?? []).filter((l) => l.bl !== "patronal");
  const imposables = lignes.filter((l) => l.bl === "imposable");
  const retenues = lignes.filter((l) => l.bl === "retenue");
  const suite = lignes.filter((l) => l.bl === "non_imposable" || l.bl === "arrondi");

  return (
    <div className="space-y-4 pb-24">
      <RhPageHeader
        backTo="/paie"
        title="Nouveau bulletin de paie"
        subtitle={regimeCode === "REGIME_2024" ? "Règles en vigueur (réforme ITS 2024)" : "Règles historiques (avant 2024)"}
        crumbs={[{ label: "Paie", to: "/paie" }, { label: "Nouveau" }]}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
        <Card>
          <CardHeader><CardTitle className="text-base">Saisie</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Employé</Label>
              <Select value={employeId} onValueChange={onSelectEmploye}>
                <SelectTrigger><SelectValue placeholder="Choisir un employé" /></SelectTrigger>
                <SelectContent>
                  {(employes ?? []).map((e) => (
                    <SelectItem key={e.employe_id} value={e.employe_id}>
                      {e.nom_complet} — {e.matricule}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {employe && (
                <p className="text-xs text-muted-foreground">
                  {employe.poste ?? "—"} · Catég. {employe.categorie ?? "—"} · CNPS {employe.numero_cnps ?? "—"} · embauché le {employe.date_embauche}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Période du</Label>
                <Input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">au</Label>
                <Input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
              </div>
              <NumField label="Jours travaillés" value={val("jours")} onChange={setO("jours_travailles")} source={src("jours_travailles")} />
              <NumField label="Parts" value={val("parts")} onChange={setO("parts")} step={0.5} source={src("parts")} />
              <NumField label="Salaire de base" value={val("salaire_base")} onChange={setO("salaire_base")} source={src("salaire_base")} />
              <NumField label="Sursalaire" value={val("sursalaire")} onChange={setO("sursalaire")} source={src("sursalaire")} />
              <NumField label="Ancienneté (%)" value={val("taux_anciennete")} onChange={setO("taux_anciennete")} step={0.5} source={src("taux_anciennete")} />
              <NumField label="Indemnité de transport" value={val("transport")} onChange={setO("transport")} source={src("transport")} />
              <NumField label="Autres indemnités non imposables" value={ov.autres_indemnites_non_imposables ?? 0} onChange={setO("autres_indemnites_non_imposables")} />
              <NumField label="Autres retenues" value={ov.autres_retenues ?? 0} onChange={setO("autres_retenues")} />
              <div className="space-y-1">
                <Label className="text-xs">Payé le</Label>
                <Input type="date" value={datePaiement} onChange={(e) => setDatePaiement(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mode de paiement</Label>
                <Select value={modePaiement} onValueChange={setModePaiement}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from(new Set([...MODES, modePaiement].filter(Boolean))).map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(calc?.anomalies ?? []).length > 0 && (
              <ul role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs">
                {calc!.anomalies.map((a) => <li key={a}>{a}</li>)}
              </ul>
            )}
            {calcError && <p role="alert" className="text-xs text-destructive">{friendlyError(calcError as Error)}</p>}
            {avertissement && (
              <p role="alert" className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
                {avertissement}
              </p>
            )}
            <Button className="w-full" disabled={!employe || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Enregistrement…" : "Enregistrer le bulletin"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Les valeurs viennent de la fiche employé et des paramètres de paie ; modifier un champ crée une saisie manuelle pour ce bulletin seulement.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Aperçu du bulletin</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full border border-border text-xs tabular-nums">
              <thead className="bg-muted/50">
                <tr className="[&>th]:border-x [&>th]:border-border [&>th]:px-2 [&>th]:py-1.5 [&>th]:text-left">
                  <th>N°</th><th>Désignation</th><th className="text-right">Nbre.</th><th className="text-right">Base</th>
                  <th className="text-right">Taux</th><th className="text-right">Gains</th><th className="text-right">Retenues</th>
                </tr>
              </thead>
              <tbody>
                {imposables.map((l, i) => <Row key={"i" + i} l={l} />)}
                <TotalRow label="SALAIRE BRUT IMPOSABLE" gain={calc?.brut_imposable ?? 0} />
                {retenues.map((l, i) => <Row key={"r" + i} l={l} />)}
                <TotalRow label="TOTAL RETENUES FISCALES & SOCIALES" retenue={calc?.total_retenues_fs ?? 0} />
                {suite.map((l, i) => <Row key={"s" + i} l={l} />)}
              </tbody>
            </table>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <Cell label="Total indemnités non impo." value={(calc?.non_imposable ?? 0) + Math.max(0, calc?.arrondi ?? 0)} />
              <Cell label="Total autres retenues" value={calc?.autres_retenues ?? 0} />
              <Cell label="Coût salarial" value={calc?.cout_salarial ?? 0} />
            </div>
            <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
              <span className="font-serif text-lg font-bold">NET À PAYER</span>
              <span className="font-serif text-2xl font-bold tabular-nums">{formatNumber(calc?.net ?? 0)} FCFA{isFetching ? " …" : ""}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ l }: { l: LigneServeur }) {
  return (
    <tr className="[&>td]:border-x [&>td]:border-border [&>td]:px-2 [&>td]:py-1">
      <td>{l.n}</td>
      <td>{l.d}</td>
      <td className="text-right">{l.nb ?? ""}</td>
      <td className="text-right">{fmt(l.b)}</td>
      <td className="text-right">{l.t ? String(l.t).replace(".", ",") : ""}</td>
      <td className="text-right">{fmt(l.g)}</td>
      <td className="text-right">{fmt(l.r)}</td>
    </tr>
  );
}

function TotalRow({ label, gain, retenue }: { label: string; gain?: number; retenue?: number }) {
  return (
    <tr className="border-y border-border font-bold italic [&>td]:border-x [&>td]:border-border [&>td]:px-2 [&>td]:py-1">
      <td />
      <td colSpan={4} className="text-center">{label}</td>
      <td className="text-right">{gain != null ? formatNumber(gain) : ""}</td>
      <td className="text-right">{retenue != null ? formatNumber(retenue) : ""}</td>
    </tr>
  );
}

function Cell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-border px-2 py-1.5 italic">
      <div className="text-muted-foreground">{label} :</div>
      <div className="font-semibold not-italic tabular-nums">{formatNumber(value)}</div>
    </div>
  );
}
