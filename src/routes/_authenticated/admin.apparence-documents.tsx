import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";
import { RecapThemePreview } from "@/components/apparence-documents/RecapThemePreview";
import { useUserRoles } from "@/hooks/use-user-roles";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { loadRecapThemeSettings, saveRecapThemeSettings } from "@/lib/recap-theme-api";
import {
  DEFAULT_RECAP_THEME,
  RECAP_DOC_TYPES,
  RECAP_THEMES,
  RECAP_THEME_IDS,
  getRecapTheme,
  type RecapThemeId,
  type RecapThemeSettings,
} from "@/lib/pdf/recap-themes";
import type { SampleDocType } from "@/lib/pdf/sample-documents";

export const Route = createFileRoute("/_authenticated/admin/apparence-documents")({
  head: () => ({
    meta: [
      { title: "Apparence des documents — GESTI-ONE" },
      {
        name: "description",
        content: "Couleur du récapitulatif des montants sur les documents de vente.",
      },
      { property: "og:title", content: "Apparence des documents — GESTI-ONE" },
      {
        property: "og:description",
        content: "Couleur du récapitulatif des montants sur les documents de vente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApparencePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

const EMPTY: RecapThemeSettings = { theme_global: DEFAULT_RECAP_THEME, theme_par_type: {} };
const same = (a: RecapThemeSettings, b: RecapThemeSettings) =>
  JSON.stringify(a) === JSON.stringify(b);

function ApparencePage() {
  const { isSuperAdmin, isLoading } = useUserRoles();
  const [saved, setSaved] = useState<RecapThemeSettings>(EMPTY);
  const [draft, setDraft] = useState<RecapThemeSettings>(EMPTY);
  const [docType, setDocType] = useState<SampleDocType>("facture");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRecapThemeSettings().then((s) => {
      setSaved(s);
      setDraft(s);
    });
  }, []);

  const dirty = !same(saved, draft);
  useUnsavedChanges(dirty);

  const previewTheme = useMemo(() => getRecapTheme(docType, null, draft).id, [docType, draft]);

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;
  if (!isSuperAdmin) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Page réservée au Super Administrateur.
      </div>
    );
  }

  const save = async () => {
    setSaving(true);
    try {
      const s = await saveRecapThemeSettings(draft);
      setSaved(s);
      setDraft(s);
      toast.success("Thème des documents enregistré");
    } catch {
      toast.error("Enregistrement impossible. Vérifiez vos droits puis réessayez.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Apparence des documents</h1>
        <p className="text-sm text-muted-foreground">
          Couleur du récapitulatif des montants sur les documents de vente. Les montants ne changent
          pas.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Thème global</CardTitle>
              <CardDescription>Utilisé par tous les documents sans thème propre.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {RECAP_THEME_IDS.map((id) => {
                const t = RECAP_THEMES[id];
                const active = draft.theme_global === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, theme_global: id }))}
                    className={`flex items-center gap-2 rounded-md border p-3 text-left text-sm transition-colors ${active ? "border-primary ring-1 ring-primary" : "hover:bg-muted"}`}
                    aria-pressed={active}
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 rounded border"
                      style={{ background: t.hex.fond, borderColor: t.hex.total }}
                    >
                      <span
                        className="m-auto h-2 w-3 rounded-sm"
                        style={{ background: t.hex.total }}
                      />
                    </span>
                    {t.nom}
                  </button>
                );
              })}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Thème par type de document</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {RECAP_DOC_TYPES.map((dt) => (
                <div key={dt.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm">{dt.label}</span>
                  <Select
                    value={draft.theme_par_type[dt.id] ?? "global"}
                    onValueChange={(v) =>
                      setDraft((d) => {
                        const par = { ...d.theme_par_type };
                        if (v === "global") delete par[dt.id];
                        else par[dt.id] = v as RecapThemeId;
                        return { ...d, theme_par_type: par };
                      })
                    }
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Utiliser le thème global</SelectItem>
                      {RECAP_THEME_IDS.map((id) => (
                        <SelectItem key={id} value={id}>
                          {RECAP_THEMES[id].nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </CardContent>
          </Card>
          <div className="flex gap-2">
            <Button onClick={save} disabled={!dirty || saving}>
              Enregistrer
            </Button>
            <Button variant="outline" onClick={() => setDraft(EMPTY)} disabled={same(draft, EMPTY)}>
              Rétablir par défaut
            </Button>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aperçu ({RECAP_THEMES[previewTheme].nom})</CardTitle>
            <CardDescription>
              Document fictif, non enregistré. Le thème n'est appliqué qu'après « Enregistrer ».
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecapThemePreview
              docType={docType}
              onDocTypeChange={setDocType}
              theme={previewTheme}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
