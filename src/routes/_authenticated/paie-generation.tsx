import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listEmployes } from "@/lib/rh-api";
import { formatNumber } from "@/lib/format";
import { friendlyError } from "@/lib/friendly-error";
import { RhPageHeader } from "@/components/rh/RhPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_authenticated/paie-generation")({
  head: () => ({ meta: [{ title: "Génération mensuelle des paies — GESTI-ONE" }] }),
  component: GenerationPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type Resultat = { ok: boolean; message: string; bulletinId?: string };

function moisCourant() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function bornes(mois: string) {
  const [y, m] = mois.split("-").map(Number);
  const fin = new Date(y, m, 0).getDate();
  return { debut: `${mois}-01`, fin: `${mois}-${String(fin).padStart(2, "0")}` };
}

function GenerationPage() {
  const qc = useQueryClient();
  const [mois, setMois] = useState(moisCourant());
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [enCours, setEnCours] = useState(false);
  const [resultats, setResultats] = useState<Record<string, Resultat>>({});

  const { data: employes, isLoading } = useQuery({ queryKey: ["employes-list"], queryFn: () => listEmployes() });
  const actifs = useMemo(
    () =>
      (employes ?? []).filter((e) => {
        const s = String((e as { statut?: string }).statut ?? "actif").toLowerCase();
        return !["inactif", "sorti", "licencie", "demissionnaire", "archive"].includes(s);
      }),
    [employes],
  );

  const { data: existants } = useQuery({
    queryKey: ["bulletins_paie", "mois", mois],
    queryFn: async () => {
      const { debut, fin } = bornes(mois);
      const { data, error } = await supabase
        .from("bulletins_paie")
        .select("employe_id")
        .gte("date_fin", debut)
        .lte("date_fin", fin);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.employe_id as string));
    },
  });

  const { data: anomalies } = useQuery({
    queryKey: ["paie_anomalies", mois, actifs.map((e) => e.employe_id).join(",")],
    enabled: actifs.length > 0,
    queryFn: async () => {
      const { debut, fin } = bornes(mois);
      const out: Record<string, string[]> = {};
      await Promise.all(actifs.map(async (e) => {
        const { data, error } = await supabase.rpc("paie_calculer_bulletin", {
          p_employe_id: e.employe_id, p_date_debut: debut, p_date_fin: fin, p_saisie: {},
        });
        out[e.employe_id] = error ? [friendlyError(error)] : ((data as { anomalies?: string[] })?.anomalies ?? []);
      }));
      return out;
    },
  });
  const bloque = (id: string) => (anomalies?.[id]?.length ?? 0) > 0;

  const toggle = (id: string) =>
    setSelection((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const disponibles = actifs.filter((e) => !existants?.has(e.employe_id) && !bloque(e.employe_id));
  const toutCoche = disponibles.length > 0 && disponibles.every((e) => selection.has(e.employe_id));

  async function generer() {
    const { debut, fin } = bornes(mois);
    const cibles = actifs.filter((e) => selection.has(e.employe_id));
    setEnCours(true);
    let ok = 0;
    for (const e of cibles) {
      const { data, error } = await supabase.rpc("paie_enregistrer_bulletin", {
        p_employe_id: e.employe_id,
        p_date_debut: debut,
        p_date_fin: fin,
        p_saisie: { mode_paiement: e.mode_paiement ?? "Virement" },
      });
      if (!error) ok++;
      setResultats((r) => ({
        ...r,
        [e.employe_id]: error
          ? { ok: false, message: friendlyError(error) }
          : { ok: true, message: "Généré", bulletinId: data as string },
      }));
    }
    setEnCours(false);
    setSelection(new Set());
    await qc.invalidateQueries({ queryKey: ["bulletins_paie"] });
    if (ok) toast.success(`${ok} bulletin(s) généré(s) en brouillon`);
    if (ok < cibles.length) toast.error(`${cibles.length - ok} échec(s)`);
  }

  return (
    <div className="space-y-4 pb-24">
      <RhPageHeader
        backTo="/paie"
        title="Génération mensuelle des paies"
        subtitle="Génère en brouillon les bulletins du mois à partir des fiches employés et des paramètres de paie"
        crumbs={[{ label: "Paie", to: "/paie" }, { label: "Génération" }]}
      />
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="space-y-1">
            <Label className="text-xs">Mois</Label>
            <Input type="month" value={mois} onChange={(e) => { setMois(e.target.value); setResultats({}); setSelection(new Set()); }} />
          </div>
          <Button onClick={generer} disabled={enCours || selection.size === 0}>
            {enCours ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
            Générer {selection.size || ""} bulletin(s)
          </Button>
          <p className="text-xs text-muted-foreground">
            Salaire, sursalaire, ancienneté, parts, primes liées à une rubrique et absences viennent des fiches. Les employés avec une anomalie ne peuvent pas être cochés.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : actifs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun employé actif avec un salaire de base.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 w-8">
                    <Checkbox
                      checked={toutCoche}
                      onCheckedChange={(v) => setSelection(v ? new Set(disponibles.map((e) => e.employe_id)) : new Set())}
                      aria-label="Tout sélectionner"
                    />
                  </th>
                  <th>Employé</th>
                  <th>Matricule</th>
                  <th className="text-right">Salaire de base</th>
                  <th className="text-right">Parts</th>
                  <th className="pl-4">État</th>
                </tr>
              </thead>
              <tbody>
                {actifs.map((e) => {
                  const deja = existants?.has(e.employe_id);
                  const res = resultats[e.employe_id];
                  return (
                    <tr key={e.employe_id} className="border-b last:border-0">
                      <td className="py-2">
                        <Checkbox
                          checked={selection.has(e.employe_id)}
                          disabled={!!deja || enCours || bloque(e.employe_id)}
                          onCheckedChange={() => toggle(e.employe_id)}
                          aria-label={`Sélectionner ${e.nom_complet}`}
                        />
                      </td>
                      <td>{e.nom_complet}</td>
                      <td className="text-muted-foreground">{e.matricule ?? "—"}</td>
                      <td className="text-right tabular-nums">{formatNumber(Number(e.salaire) || 0)} FCFA</td>
                      <td className="text-right">{Number(e.parts) || 1}</td>
                      <td className="pl-4">
                        {res?.ok && res.bulletinId ? (
                          <Link to="/paie/$bulletinId" params={{ bulletinId: res.bulletinId }} className="text-primary underline">
                            Généré — ouvrir
                          </Link>
                        ) : res ? (
                          <span className="text-destructive">{res.message}</span>
                        ) : bloque(e.employe_id) ? (
                          <span className="text-destructive">
                            {anomalies![e.employe_id].join(" · ")} —{" "}
                            <Link to="/employes/$employeId" params={{ employeId: e.employe_id }} className="underline">corriger la fiche</Link>
                          </span>
                        ) : deja ? (
                          <span className="text-muted-foreground">Bulletin déjà existant</span>
                        ) : (
                          <span className="text-muted-foreground">À générer</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
