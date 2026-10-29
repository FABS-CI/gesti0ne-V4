import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Cpu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { regimePourDate } from "@/lib/paie/regimes-ci";
import {
  CLES_MOTEUR,
  cleMoteurDe,
  tranchesDe,
  valeurNumerique,
} from "@/lib/paie/parametres-effectifs";

// Dernier jour du mois "yyyy-mm" : le moteur choisit régime et paramètres datés sur la fin de période.
function finDeMois(mois: string): string {
  const [y, m] = mois.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function afficher(v: number | null, unite: "%" | "FCFA") {
  if (v === null) return <span className="font-medium text-destructive">absent</span>;
  return unite === "%" ? `${formatNumber(v, 2)} %` : `${formatNumber(v)} FCFA`;
}

/**
 * Paramètres réellement utilisés par le moteur SQL pour une période, contrôle serveur
 * des paramètres, et lignes de la liste éditable que le moteur ignore.
 */
export function ParametresEffectifsCard() {
  const [mois, setMois] = useState(() => new Date().toISOString().slice(0, 7));
  const date = finDeMois(mois);
  const regime = regimePourDate(date);

  const q = useQuery({
    queryKey: ["paie-parametres-effectifs", regime, date],
    queryFn: async () => {
      const eff = await supabase.rpc("_paie_parametres_effectifs", {
        p_regime: regime,
        p_date: date,
      });
      if (eff.error) throw eff.error;
      const p = (eff.data ?? {}) as Record<string, unknown>;
      const [ctrl, lignes] = await Promise.all([
        supabase.rpc("_paie_parametres_controle", { p_regime: regime, p: eff.data ?? {} }),
        supabase.from("paie_parametres").select("cle, code, libelle, valeur, actif"),
      ]);
      if (ctrl.error) throw ctrl.error;
      if (lignes.error) throw lignes.error;
      const ignores = (lignes.data ?? []).filter(
        (l) => l.actif !== false && cleMoteurDe(l.cle, l.valeur, p) === null,
      );
      return { p, problemes: (ctrl.data ?? []) as string[], ignores };
    },
  });

  const cles = CLES_MOTEUR.filter((c) =>
    regime === "REGIME_2024"
      ? !["its_taux_forfait", "cn_abattement"].includes(c.cle)
      : c.cle !== "ricf_par_demi_part",
  );
  const bareme = q.data
    ? tranchesDe(q.data.p[regime === "REGIME_2024" ? "its_bareme" : "cn_bareme"])
    : [];

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className="h-4 w-4" /> Paramètres réellement utilisés par le calcul
          </CardTitle>
          <CardDescription>
            Valeurs lues par le moteur de paie pour la période choisie (
            {regime === "REGIME_2024" ? "régime 2024" : "régime 2022"}). Lecture seule : la liste
            ci-dessous ne modifie le calcul que pour les codes reconnus.
          </CardDescription>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm">
          Période
          <Input
            type="month"
            value={mois}
            onChange={(e) => e.target.value && setMois(e.target.value)}
            className="w-40"
          />
        </label>
      </CardHeader>
      <CardContent className="space-y-4">
        {regime === "REGIME_2024" && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>ITS salarié forcé à 0 depuis 2024</AlertTitle>
            <AlertDescription>
              Le moteur n'applique pas le barème ITS ci-dessous (migration 0081, choix utilisateur)
              : aucun ITS n'est retenu sur les bulletins. À faire valider par le comptable avant
              toute déclaration DGI.
            </AlertDescription>
          </Alert>
        )}

        {q.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : q.isError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Paramètres effectifs illisibles</AlertTitle>
            <AlertDescription>{(q.error as Error).message}</AlertDescription>
          </Alert>
        ) : q.data ? (
          <>
            {q.data.problemes.length > 0 ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Calcul bloqué : paramètres invalides</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4">
                    {q.data.problemes.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" /> Paramètres complets et cohérents
                (contrôle serveur).
              </p>
            )}

            <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {cles.map((c) => (
                <div key={c.cle} className="flex justify-between gap-3 border-b py-1.5">
                  <span>
                    <Badge variant="outline" className="mr-2 font-normal">
                      {c.categorie}
                    </Badge>
                    {c.libelle}
                    {c.part !== "—" && (
                      <span className="text-muted-foreground"> · part {c.part}</span>
                    )}
                  </span>
                  <span className="whitespace-nowrap font-medium tabular-nums">
                    {afficher(valeurNumerique(q.data!.p, c.cle), c.unite)}
                  </span>
                </div>
              ))}
            </div>

            <div>
              <p className="mb-1 text-sm font-medium">
                {regime === "REGIME_2024"
                  ? "Barème ITS mensuel (non appliqué, voir alerte)"
                  : "Barème CN (après abattement)"}
              </p>
              <div className="grid gap-1 text-sm sm:grid-cols-3">
                {bareme.map((t) => (
                  <div key={t.de} className="rounded border px-2 py-1 tabular-nums">
                    {formatNumber(t.de)} – {t.a === null ? "et plus" : formatNumber(t.a)} :{" "}
                    <strong>{formatNumber(t.taux, 2)} %</strong>
                  </div>
                ))}
              </div>
            </div>

            {q.data.ignores.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>
                  {q.data.ignores.length} paramètre(s) de la liste sans effet sur le calcul
                </AlertTitle>
                <AlertDescription>
                  Le moteur ne lit pas ces codes : modifier leur valeur ne change aucun bulletin.
                  <span className="mt-1 block font-mono text-xs">
                    {q.data.ignores.map((l) => l.code ?? l.cle).join(" · ")}
                  </span>
                </AlertDescription>
              </Alert>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
