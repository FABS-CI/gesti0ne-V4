// Thèmes de couleur du récapitulatif des montants (documents de vente).
// Purement visuel : aucun montant n'en dépend.
import { rgb, type RGB } from "pdf-lib";

export type RecapThemeId = "bleu" | "ardoise" | "vert" | "indigo";

export type RecapThemeDocType =
  | "facture"
  | "proforma"
  | "bon_commande"
  | "bon_livraison"
  | "avoir"
  | "bon_retour"
  | "specimen"
  | "recu"
  | "releve";

export type RecapTheme = {
  id: RecapThemeId;
  nom: string;
  hex: { fond: string; filet: string; bordure: string; total: string; texte: string };
  fond: RGB;
  filet: RGB;
  bordure: RGB;
  total: RGB;
  texte: RGB;
};

export type RecapThemeSettings = {
  theme_global: RecapThemeId;
  theme_par_type: Partial<Record<RecapThemeDocType, RecapThemeId>>;
};

function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return rgb(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  );
}

function make(id: RecapThemeId, nom: string, hex: RecapTheme["hex"]): RecapTheme {
  return {
    id,
    nom,
    hex,
    fond: hexToRgb(hex.fond),
    filet: hexToRgb(hex.filet),
    bordure: hexToRgb(hex.bordure),
    total: hexToRgb(hex.total),
    texte: hexToRgb(hex.texte),
  };
}

export const RECAP_THEMES: Record<RecapThemeId, RecapTheme> = {
  bleu: make("bleu", "Bleu clair", { fond: "#EFF6FF", filet: "#BFDBFE", bordure: "#BFDBFE", total: "#2563EB", texte: "#1E3A8A" }),
  ardoise: make("ardoise", "Gris ardoise", { fond: "#F1F5F9", filet: "#CBD5E1", bordure: "#CBD5E1", total: "#475569", texte: "#1F2937" }),
  vert: make("vert", "Vert émeraude", { fond: "#ECFDF5", filet: "#A7F3D0", bordure: "#A7F3D0", total: "#059669", texte: "#064E3B" }),
  indigo: make("indigo", "Indigo", { fond: "#EEF2FF", filet: "#C7D2FE", bordure: "#C7D2FE", total: "#4F46E5", texte: "#312E81" }),
};

export const RECAP_THEME_IDS = Object.keys(RECAP_THEMES) as RecapThemeId[];
export const DEFAULT_RECAP_THEME: RecapThemeId = "bleu";

export const RECAP_DOC_TYPES: { id: RecapThemeDocType; label: string }[] = [
  { id: "facture", label: "Facture" },
  { id: "proforma", label: "Proforma" },
  { id: "bon_commande", label: "Bon de commande" },
  { id: "bon_livraison", label: "Bon de livraison" },
  { id: "avoir", label: "Avoir" },
  { id: "bon_retour", label: "Bon de retour" },
  { id: "specimen", label: "Spécimens" },
  { id: "recu", label: "Reçu de paiement" },
  { id: "releve", label: "Relevé / État de compte" },
];

export function isRecapThemeId(v: unknown): v is RecapThemeId {
  return typeof v === "string" && v in RECAP_THEMES;
}

/** Normalise une ligne lue en base (valeurs inconnues ignorées). */
export function normalizeRecapSettings(raw: unknown): RecapThemeSettings {
  const r = (raw ?? {}) as { theme_global?: unknown; theme_par_type?: unknown };
  const par: RecapThemeSettings["theme_par_type"] = {};
  if (r.theme_par_type && typeof r.theme_par_type === "object") {
    for (const [k, v] of Object.entries(r.theme_par_type as Record<string, unknown>)) {
      if (isRecapThemeId(v) && RECAP_DOC_TYPES.some((d) => d.id === k)) {
        par[k as RecapThemeDocType] = v;
      }
    }
  }
  return {
    theme_global: isRecapThemeId(r.theme_global) ? r.theme_global : DEFAULT_RECAP_THEME,
    theme_par_type: par,
  };
}

let CACHE: RecapThemeSettings = { theme_global: DEFAULT_RECAP_THEME, theme_par_type: {} };

export function getRecapThemeSync(): RecapThemeSettings {
  return CACHE;
}

export function setRecapThemeSettings(s: unknown): void {
  CACHE = normalizeRecapSettings(s);
}

/** Libellé de type utilisé par le moteur PDF → clé de réglage. */
export function recapDocTypeFromLabel(label?: string | null): RecapThemeDocType | null {
  const l = (label ?? "").toLowerCase();
  if (l.startsWith("facture")) return "facture";
  if (l.startsWith("proforma")) return "proforma";
  if (l.startsWith("commande") || l.startsWith("bon de commande")) return "bon_commande";
  if (l.startsWith("bon de livraison")) return "bon_livraison";
  if (l.startsWith("avoir")) return "avoir";
  if (l.startsWith("bon de retour")) return "bon_retour";
  if (l.startsWith("spécimen") || l.startsWith("specimen")) return "specimen";
  if (l.startsWith("reçu") || l.startsWith("recu")) return "recu";
  if (l.startsWith("relevé") || l.startsWith("releve") || l.startsWith("état de compte")) return "releve";
  return null;
}

/** Thème effectif : override (aperçu) > thème du type > thème global > bleu. */
export function getRecapTheme(
  docType?: RecapThemeDocType | null,
  override?: RecapThemeId | null,
  settings: RecapThemeSettings = CACHE,
): RecapTheme {
  if (isRecapThemeId(override)) return RECAP_THEMES[override];
  const parType = docType ? settings.theme_par_type[docType] : undefined;
  if (isRecapThemeId(parType)) return RECAP_THEMES[parType];
  if (isRecapThemeId(settings.theme_global)) return RECAP_THEMES[settings.theme_global];
  return RECAP_THEMES[DEFAULT_RECAP_THEME];
}
