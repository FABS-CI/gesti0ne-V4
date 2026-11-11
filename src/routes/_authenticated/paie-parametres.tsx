import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ListCard, ListPageHeader } from "@/components/common/list/ListParts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { usePermissions } from "@/hooks/use-permissions";
import {
  type Bareme,
  type RegimeJson,
  champsDuRegime,
  changementsRegime,
  erreurBareme,
  erreurChamp,
  valeurChamp,
} from "@/lib/paie/regime-form";

export const Route = createFileRoute("/_authenticated/paie-parametres")({
  head: () => ({
    meta: [
      { title: "Paramètres Paie CI — GESTI-one" },
      { name: "description", content: "Taux, plafonds et barèmes utilisés pour calculer les bulletins de paie." },
      { property: "og:title", content: "Paramètres Paie CI — GESTI-one" },
      { property: "og:description", content: "Taux, plafonds et barèmes utilisés pour calculer les bulletins de paie." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ParametresPaiePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type Regime = { code: string; libelle: string; date_effet: string | null; parametres: RegimeJson };
type Historique = { id: string; regime_code: string; anciens: RegimeJson | null; nouveaux: RegimeJson; modifie_par_nom: string | null; modifie_le: string };

const GROUPES = ["Cotisations salarié", "Cotisations employeur", "Impôts", "Primes et arrondi"] as const;

function ParametresPaiePage() {
  const { has } = usePermissions();
  const peutModifier = has("rh.modifier");
  const regimes = useQuery({
    queryKey: ["paie", "regimes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("paie_regimes").select("code, libelle, date_effet, parametres").order("date_effet", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Regime[];
    },
  });
  const historique = useQuery({
    queryKey: ["paie", "regimes", "historique"],
    queryFn: async () => {
      const { data, error } = await supabase.from("paie_regimes_historique").select("*").order("modifie_le", { ascending: false }).limit(30);
      if (error) throw error;
      return (data ?? []) as unknown as Historique[];
    },
  });

  return (
    <div className="space-y-6">
      <ListPageHeader
        overline="Paie"
        title="Paramètres Paie CI"
        description="Ces valeurs sont les seules utilisées pour calculer les bulletins. Un bulletin déjà validé ne change pas."
      />
      {regimes.isLoading ? (
        <ListCard><p className="p-6 ds-secondary">Chargement…</p></ListCard>
      ) : regimes.error ? (
        <ListCard><p className="p-6 text-destructive">Impossible de charger les paramètres.</p></ListCard>
      ) : (
        <Tabs defaultValue={regimes.data?.[0]?.code}>
          <TabsList>
            {regimes.data?.map((r) => (
              <TabsTrigger key={r.code} value={r.code}>{r.code === "REGIME_2024" ? "Régime 2024" : "Régime 2022"}</TabsTrigger>
            ))}
          </TabsList>
          {regimes.data?.map((r) => (
            <TabsContent key={r.code} value={r.code}>
              <RegimeEditor regime={r} peutModifier={peutModifier} />
            </TabsContent>
          ))}
        </Tabs>
      )}
      <ListCard>
        <div className="p-5">
          <h2 className="ds-section-title text-foreground">Historique des modifications</h2>
          {historique.data?.length ? (
            <ul className="mt-3 divide-y divide-border">
              {historique.data.map((h) => {
                const diff = Object.keys(changementsRegime(h.anciens ?? {}, h.nouveaux));
                return (
                  <li key={h.id} className="py-2 text-sm">
                    <span className="font-medium">{new Date(h.modifie_le).toLocaleString("fr-FR")}</span>
                    {" · "}{h.regime_code === "REGIME_2024" ? "Régime 2024" : "Régime 2022"}
                    {" · "}{h.modifie_par_nom ?? "—"}
                    <div className="ds-secondary">
                      {diff.map((k) => `${k} : ${JSON.stringify(h.anciens?.[k] ?? "—")} → ${JSON.stringify(h.nouveaux[k])}`).join(" ; ")}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 ds-secondary">Aucune modification enregistrée.</p>
          )}
        </div>
      </ListCard>
    </div>
  );
}

function RegimeEditor({ regime, peutModifier }: { regime: Regime; peutModifier: boolean }) {
  const qc = useQueryClient();
  const champs = useMemo(() => champsDuRegime(regime.code), [regime.code]);
  const initial = useMemo(() => {
    const p: RegimeJson = {};
    champs.forEach((c) => (p[c.cle] = valeurChamp(regime.parametres, c.cle)));
    p.arrondi_mode = regime.parametres.arrondi_mode === "proche" ? "proche" : "superieur";
    p.fdfp_actif = regime.parametres.fdfp_actif === true;
    if (regime.code === "REGIME_2024") p.its_bareme = (regime.parametres.its_bareme as Bareme) ?? [];
    if (regime.code === "REGIME_2022") p.cn_bareme = (regime.parametres.cn_bareme as Bareme) ?? [];
    return p;
  }, [regime, champs]);
  const [form, setForm] = useState<RegimeJson>(initial);
  useEffect(() => setForm(initial), [initial]);

  const erreurs: Record<string, string> = {};
  champs.forEach((c) => {
    const e = erreurChamp(c, form[c.cle] as number);
    if (e) erreurs[c.cle] = e;
  });
  for (const k of ["its_bareme", "cn_bareme"]) {
    if (form[k]) {
      const e = erreurBareme(form[k] as Bareme);
      if (e) erreurs[k] = e;
    }
  }
  const changes = changementsRegime(regime.parametres, form);
  const modifie = Object.keys(changementsRegime(initial, form)).length > 0;

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("paie_regime_enregistrer", { _code: regime.code, _parametres: changes as never });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Paramètres enregistrés");
      qc.invalidateQueries({ queryKey: ["paie", "regimes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const baremeKey = regime.code === "REGIME_2024" ? "its_bareme" : "cn_bareme";
  const bareme = (form[baremeKey] as Bareme) ?? [];

  return (
    <ListCard className="mt-4">
      <div className="space-y-6 p-5">
        <p className="ds-secondary">{regime.libelle}{regime.date_effet ? ` — applicable depuis le ${new Date(regime.date_effet).toLocaleDateString("fr-FR")}` : ""}</p>
        {GROUPES.map((g) => {
          const list = champs.filter((c) => c.groupe === g);
          if (!list.length) return null;
          return (
            <section key={g}>
              <h3 className="ds-overline mb-2">{g}</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((c) => (
                  <div key={c.cle}>
                    <Label htmlFor={`${regime.code}-${c.cle}`}>{c.libelle} ({c.unite})</Label>
                    <Input
                      id={`${regime.code}-${c.cle}`}
                      type="number"
                      step="any"
                      disabled={!peutModifier}
                      value={String(form[c.cle] ?? "")}
                      onChange={(e) => set(c.cle, e.target.value === "" ? NaN : Number(e.target.value))}
                    />
                    {erreurs[c.cle] ? <p className="mt-1 text-xs text-destructive">{erreurs[c.cle]}</p> : null}
                  </div>
                ))}
                {g === "Primes et arrondi" ? (
                  <div>
                    <Label htmlFor={`${regime.code}-arrondi`}>Sens de l'arrondi</Label>
                    <select
                      id={`${regime.code}-arrondi`}
                      disabled={!peutModifier}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={String(form.arrondi_mode)}
                      onChange={(e) => set("arrondi_mode", e.target.value)}
                    >
                      <option value="superieur">Au-dessus</option>
                      <option value="proche">Au plus proche</option>
                    </select>
                  </div>
                ) : null}
                {g === "Cotisations employeur" ? (
                  <label className="flex items-center gap-2 pt-6 text-sm">
                    <input type="checkbox" disabled={!peutModifier} checked={form.fdfp_actif === true} onChange={(e) => set("fdfp_actif", e.target.checked)} />
                    FDFP appliqué
                  </label>
                ) : null}
              </div>
            </section>
          );
        })}

        <section>
          <h3 className="ds-overline mb-2">{regime.code === "REGIME_2024" ? "Barème ITS" : "Barème contribution nationale"}</h3>
          <div className="space-y-2">
            {bareme.map(([max, taux], i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-20 ds-secondary">Tranche {i + 1}</span>
                <Input
                  aria-label={`Plafond tranche ${i + 1}`}
                  className="w-40"
                  type="number"
                  placeholder="Sans plafond"
                  disabled={!peutModifier}
                  value={max === null ? "" : String(max)}
                  onChange={(e) => {
                    const b = bareme.map((t) => [...t] as [number | null, number]);
                    b[i][0] = e.target.value === "" ? null : Number(e.target.value);
                    set(baremeKey, b);
                  }}
                />
                <span>FCFA à</span>
                <Input
                  aria-label={`Taux tranche ${i + 1}`}
                  className="w-24"
                  type="number"
                  step="any"
                  disabled={!peutModifier}
                  value={String(taux)}
                  onChange={(e) => {
                    const b = bareme.map((t) => [...t] as [number | null, number]);
                    b[i][1] = Number(e.target.value);
                    set(baremeKey, b);
                  }}
                />
                <span>%</span>
                {peutModifier ? (
                  <Button variant="ghost" size="icon" aria-label={`Retirer la tranche ${i + 1}`} onClick={() => set(baremeKey, bareme.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            ))}
            {peutModifier ? (
              <Button variant="outline" size="sm" onClick={() => set(baremeKey, [...bareme, [null, 0]])}>
                <Plus className="mr-1 h-4 w-4" /> Ajouter une tranche
              </Button>
            ) : null}
            {erreurs[baremeKey] ? <p className="text-xs text-destructive">{erreurs[baremeKey]}</p> : null}
          </div>
        </section>

        {peutModifier ? (
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" disabled={!modifie || save.isPending} onClick={() => setForm(initial)}>Annuler</Button>
            <Button disabled={!modifie || Object.keys(erreurs).length > 0 || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        ) : (
          <p className="ds-secondary">Lecture seule : il faut le droit de modifier les ressources humaines.</p>
        )}
      </div>
    </ListCard>
  );
}
