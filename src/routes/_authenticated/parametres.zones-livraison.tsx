import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getParametre, setParametre } from "@/lib/parametres-api";
import { COMMUNES_ABIDJAN, VILLES_CI, normalize as normLoc } from "@/lib/ci-locations";
import { Combobox } from "@/components/ui/combobox";
import { usePermissions } from "@/hooks/use-permissions";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { friendlyError } from "@/lib/friendly-error";

const KEY = "colisage.zones_livraison_directe";

export const Route = createFileRoute("/_authenticated/parametres/zones-livraison")({
  component: ZonesLivraisonPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function ZonesLivraisonPage() {
  const { has } = usePermissions();
  const canEdit = has("parametres.modifier");

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["param-zones-livraison-directe-admin"],
    queryFn: async () => {
      const raw = await getParametre(KEY);
      const defaults = { villes: ["Abidjan"], communes: COMMUNES_ABIDJAN };
      if (!raw) return defaults;
      try {
        const p = JSON.parse(raw) as { villes?: string[]; communes?: string[] };
        return {
          villes: p.villes?.length ? p.villes : defaults.villes,
          communes: p.communes?.length ? p.communes : defaults.communes,
        };
      } catch {
        return defaults;
      }
    },
  });

  const [villes, setVilles] = useState("");
  const [communes, setCommunes] = useState("");
  const [saving, setSaving] = useState(false);

  // Simulateur : choisir une ville / commune et voir le mode détecté.
  const [simVille, setSimVille] = useState("");
  const [simCommune, setSimCommune] = useState("");

  const currentVilles = villes
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const currentCommunes = communes
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const simulation = (() => {
    const v = normLoc(simVille);
    const c = normLoc(simCommune);
    if (!v && !c)
      return {
        mode: null as null | "livraison" | "expedition",
        raison: "Aucune ville ni commune saisie",
      };
    const villesDir = currentVilles.map(normLoc);
    const communesDir = currentCommunes.map(normLoc);
    if (v && villesDir.includes(v))
      return {
        mode: "livraison" as const,
        raison: `Ville « ${simVille} » listée en livraison directe`,
      };
    if (c && communesDir.includes(c))
      return {
        mode: "livraison" as const,
        raison: `Commune « ${simCommune} » listée en livraison directe`,
      };
    return {
      mode: "expedition" as const,
      raison: `« ${simVille || simCommune} » hors zone de livraison directe`,
    };
  })();

  useEffect(() => {
    if (data) {
      setVilles(data.villes.join("\n"));
      setCommunes(data.communes.join("\n"));
    }
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        villes: villes
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        communes: communes
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      await setParametre(KEY, JSON.stringify(payload));
      toast.success("Zones enregistrées");
      refetch();
    } catch (e) {
      toast.error(friendlyError(e, "Erreur d'enregistrement"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="ds-page-title flex items-center gap-2">
          <MapPin className="h-6 w-6 text-primary" /> Zones de livraison directe
        </h1>
        <p className="text-sm text-muted-foreground">
          Villes et communes qui déclenchent automatiquement le mode «&nbsp;Livraison directe&nbsp;»
          dans le colisage. Tout ce qui n'est pas listé bascule automatiquement en
          «&nbsp;Expédition&nbsp;».
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration (une entrée par ligne)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Villes en livraison directe</Label>
            <Textarea
              rows={10}
              value={villes}
              onChange={(e) => setVilles(e.target.value)}
              disabled={!canEdit || isLoading}
              placeholder="Abidjan"
            />
          </div>
          <div>
            <Label>Communes en livraison directe</Label>
            <Textarea
              rows={10}
              value={communes}
              onChange={(e) => setCommunes(e.target.value)}
              disabled={!canEdit || isLoading}
              placeholder="Cocody\nPlateau\nYopougon"
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button onClick={save} disabled={!canEdit || saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Simulateur de détection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Utilise la configuration ci-dessus (même non enregistrée) et la normalisation appliquée
            dans le colisage (accents, casse, tirets et espaces multiples ignorés).
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Ville</Label>
              <Combobox
                value={simVille}
                onChange={(v) => setSimVille(v ?? "")}
                options={VILLES_CI}
                placeholder="Choisir ou saisir une ville"
              />
            </div>
            <div>
              <Label>Commune</Label>
              <Combobox
                value={simCommune}
                onChange={(v) => setSimCommune(v ?? "")}
                options={COMMUNES_ABIDJAN}
                placeholder="Choisir ou saisir une commune"
              />
            </div>
          </div>
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <div>
              <span className="text-muted-foreground">Mode détecté&nbsp;:</span>{" "}
              <strong>
                {simulation.mode === "livraison"
                  ? "Livraison directe"
                  : simulation.mode === "expedition"
                    ? "Expédition"
                    : "—"}
              </strong>
            </div>
            <div className="text-xs text-muted-foreground">Raison&nbsp;: {simulation.raison}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
