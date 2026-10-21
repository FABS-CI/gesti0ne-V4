import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { avertissementPeriode } from "@/lib/paie/periode-avertissement";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { listEmployes, type Employe } from "@/lib/rh-api";
import {
  calculerBulletin,
  regimeDepuisParametres,
  regimePourDate,
  type LigneCalc,
  type RegimeCode,
} from "@/lib/paie/regimes-ci";
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

function NumField({ label, value, onChange, step }: { label: string; value: number; onChange: (n: number) => void; step?: number }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
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
  const [jours, setJours] = useState(30);
  const [salaireBase, setSalaireBase] = useState(0);
  const [sursalaire, setSursalaire] = useState(0);
  const [tauxAnc, setTauxAnc] = useState(0);
  const [transport, setTransport] = useState(0);
  const [autresNI, setAutresNI] = useState(0);
  const [autresRet, setAutresRet] = useState(0);
  const [parts, setParts] = useState(1);
  const [datePaiement, setDatePaiement] = useState("");
  const [modePaiement, setModePaiement] = useState("Virement");

  const { data: employes } = useQuery({ queryKey: ["employes-list"], queryFn: () => listEmployes() });
  const { data: regimes } = useQuery({
    queryKey: ["paie_regimes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("paie_regimes").select("code, parametres");
      if (error) throw error;
      return data ?? [];
    },
  });

  const employe: Employe | undefined = useMemo(
    () => employes?.find((e) => e.employe_id === employeId),
    [employes, employeId],
  );

  const onSelectEmploye = (id: string) => {
    setEmployeId(id);
    const emp = employes?.find((e) => e.employe_id === id);
    if (!emp) return;
    setSalaireBase(Number(emp.salaire) || 0);
    setParts(Number(emp.parts) || 1);
    if (emp.mode_paiement) setModePaiement(emp.mode_paiement);
  };

  const avertissement = avertissementPeriode(dateDebut, datePaiement, new Date().toISOString().slice(0, 10));
  const regimeCode: RegimeCode = regimePourDate(dateFin || init.fin);
  const params = useMemo(() => {
    const row = regimes?.find((r) => r.code === regimeCode);
    return regimeDepuisParametres(regimeCode, (row?.parametres ?? null) as Record<string, unknown> | null);
  }, [regimes, regimeCode]);

  const result = useMemo(
    () =>
      calculerBulletin(
        {
          salaireBase,
          sursalaire,
          tauxAnciennete: tauxAnc,
          transport,
          autresIndemnitesNonImposables: autresNI,
          autresRetenues: autresRet,
          parts,
          joursTravailles: jours,
        },
        params,
      ),
    [salaireBase, sursalaire, tauxAnc, transport, autresNI, autresRet, parts, jours, params],
  );

  const save = useMutation({
    mutationFn: async () => {
      if (!employe) throw new Error("Sélectionnez un employé");
      if (!dateDebut || !dateFin || dateFin < dateDebut) throw new Error("Période invalide");
      const { data, error } = await supabase.rpc("paie_enregistrer_bulletin", {
        p_employe_id: employe.employe_id,
        p_date_debut: dateDebut,
        p_date_fin: dateFin,
        p_saisie: {
          salaire_base: salaireBase,
          sursalaire,
          taux_anciennete: tauxAnc,
          transport,
          autres_indemnites_non_imposables: autresNI,
          autres_retenues: autresRet,
          parts,
          jours_travailles: jours,
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

  const lignes = result.lignes.filter((l) => l.bloc !== "patronal");
  const imposables = lignes.filter((l) => l.bloc === "imposable");
  const retenues = lignes.filter((l) => l.bloc === "retenue");
  const suite = lignes.filter((l) => l.bloc === "non_imposable" || l.bloc === "arrondi");

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
              <NumField label="Jours travaillés" value={jours} onChange={setJours} />
              <div className="space-y-1">
                <Label className="text-xs">Parts</Label>
                <Select value={String(parts)} onValueChange={(v) => setParts(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((p) => (
                      <SelectItem key={p} value={String(p)}>{p.toFixed(1).replace(".", ",")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <NumField label="Salaire de base" value={salaireBase} onChange={setSalaireBase} />
              <NumField label="Sursalaire" value={sursalaire} onChange={setSursalaire} />
              <NumField label="Ancienneté (%)" value={tauxAnc} onChange={setTauxAnc} step={0.5} />
              <NumField label="Indemnité de transport" value={transport} onChange={setTransport} />
              <NumField label="Autres indemnités non imposables" value={autresNI} onChange={setAutresNI} />
              <NumField label="Autres retenues" value={autresRet} onChange={setAutresRet} />
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
            {avertissement && (
              <p role="alert" className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
                {avertissement}
              </p>
            )}
            <Button className="w-full" disabled={!employe || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Enregistrement…" : "Enregistrer le bulletin"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Les montants sont recalculés et enregistrés par le serveur. Le bulletin est créé en brouillon puis validé directement.
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
                {imposables.map((l) => <Row key={l.ordre} l={l} />)}
                <TotalRow label="SALAIRE BRUT IMPOSABLE" gain={result.brutImposable} />
                {retenues.map((l) => <Row key={l.ordre} l={l} />)}
                <TotalRow label="TOTAL RETENUES FISCALES & SOCIALES" retenue={result.totalRetenuesFiscalesSociales} />
                {suite.map((l) => <Row key={l.ordre} l={l} />)}
              </tbody>
            </table>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <Cell label="Total indemnités non impo." value={result.totalIndemnitesNonImposables} />
              <Cell label="Total autres retenues" value={result.totalAutresRetenues} />
              <Cell label="Coût salarial" value={result.coutSalarial} />
            </div>
            <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
              <span className="font-serif text-lg font-bold">NET À PAYER</span>
              <span className="font-serif text-2xl font-bold tabular-nums">{formatNumber(result.netAPayer)} FCFA</span>
            </div>
            {regimeCode === "REGIME_2024" && (
              <p className="mt-2 text-xs text-muted-foreground">
                ITS avant réduction {formatNumber(result.itsBrut)} − réduction pour charges de famille {formatNumber(result.ricf)}.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ l }: { l: LigneCalc }) {
  return (
    <tr className="[&>td]:border-x [&>td]:border-border [&>td]:px-2 [&>td]:py-1">
      <td>{l.numero}</td>
      <td>{l.designation}</td>
      <td className="text-right">{l.nombre ?? ""}</td>
      <td className="text-right">{fmt(l.base)}</td>
      <td className="text-right">{l.taux ? String(l.taux).replace(".", ",") : ""}</td>
      <td className="text-right">{fmt(l.gain)}</td>
      <td className="text-right">{fmt(l.retenue)}</td>
    </tr>
  );
}

function TotalRow({ label, gain, retenue }: { label: string; gain?: number; retenue?: number }) {
  return (
    <tr className="border-y border-border font-bold italic [&>td]:border-x [&>td]:border-border [&>td]:px-2 [&>td]:py-1">
      <td />
      <td colSpan={4} className="text-center">{label}...</td>
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
