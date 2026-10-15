// Réglage global du thème des récapitulatifs PDF (table document_theme_settings, une ligne).
import { supabase } from "@/integrations/supabase/client";
import { clearPdfCache } from "@/lib/pdf/pdfCache";
import {
  normalizeRecapSettings,
  setRecapThemeSettings,
  getRecapThemeSync,
  type RecapThemeSettings,
} from "@/lib/pdf/recap-themes";

/** Charge le réglage ; en cas d'absence ou d'erreur, garde le thème bleu sans erreur. */
export async function loadRecapThemeSettings(): Promise<RecapThemeSettings> {
  try {
    const { data, error } = await supabase
      .from("document_theme_settings")
      .select("theme_global, theme_par_type")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    setRecapThemeSettings(data ?? {});
  } catch {
    setRecapThemeSettings({});
  }
  return getRecapThemeSync();
}

export async function saveRecapThemeSettings(s: RecapThemeSettings): Promise<RecapThemeSettings> {
  const next = normalizeRecapSettings(s);
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from("document_theme_settings").upsert({
    id: 1,
    theme_global: next.theme_global,
    theme_par_type: next.theme_par_type,
    updated_at: new Date().toISOString(),
    updated_by: u.user?.id ?? null,
  });
  if (error) throw error;
  setRecapThemeSettings(next);
  // Les PDF déjà en cache gardaient l'ancienne couleur.
  clearPdfCache();
  return next;
}
