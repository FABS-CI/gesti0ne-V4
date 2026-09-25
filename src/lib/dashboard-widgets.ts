import { supabase } from "@/integrations/supabase/client";
import { formatFCFA } from "@/lib/format";
import {
  Users,
  Package,
  FileText,
  Wallet,
  Truck,
  AlertTriangle,
  ShoppingCart,
  BookOpenCheck,
  type LucideIcon,
} from "lucide-react";

export type WidgetId =
  | "clients_total"
  | "produits_total"
  | "factures_mois"
  | "ca_mois"
  | "bl_en_cours"
  | "stock_faible"
  | "commandes_ouvertes"
  | "paiements_recus_mois";

export type WidgetDef = {
  id: WidgetId;
  title: string;
  icon: LucideIcon;
  accent: string;
  fetch: () => Promise<{ value: string; sub?: string }>;
};

const startOfMonthISO = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
};

export const WIDGETS: Record<WidgetId, WidgetDef> = {
  clients_total: {
    id: "clients_total",
    title: "Clients",
    icon: Users,
    accent: "text-blue-600",
    fetch: async () => {
      const { count } = await supabase.from("clients").select("*", { count: "exact", head: true });
      return { value: String(count ?? 0), sub: "total" };
    },
  },
  produits_total: {
    id: "produits_total",
    title: "Produits",
    icon: Package,
    accent: "text-violet-600",
    fetch: async () => {
      const { count } = await supabase.from("produits").select("*", { count: "exact", head: true });
      return { value: String(count ?? 0), sub: "référencés" };
    },
  },
  factures_mois: {
    id: "factures_mois",
    title: "Factures du mois",
    icon: FileText,
    accent: "text-emerald-600",
    fetch: async () => {
      const { count } = await supabase
        .from("factures")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startOfMonthISO());
      return { value: String(count ?? 0), sub: "ce mois" };
    },
  },
  ca_mois: {
    id: "ca_mois",
    title: "CA encaissé du mois",
    icon: Wallet,
    accent: "text-amber-600",
    fetch: async () => {
      const { data } = await supabase
        .from("paiements")
        .select("montant")
        .eq("statut", "valide")
        .gte("date_paiement", startOfMonthISO().slice(0, 10));
      const sum = (data ?? []).reduce((s, r) => s + Number(r.montant ?? 0), 0);
      return { value: formatFCFA(sum), sub: "paiements validés" };
    },
  },
  bl_en_cours: {
    id: "bl_en_cours",
    title: "BL en cours",
    icon: Truck,
    accent: "text-sky-600",
    fetch: async () => {
      const { count } = await supabase
        .from("bons_livraison")
        .select("*", { count: "exact", head: true })
        .neq("statut", "livre");
      return { value: String(count ?? 0), sub: "non livrés" };
    },
  },
  stock_faible: {
    id: "stock_faible",
    title: "Stock faible",
    icon: AlertTriangle,
    accent: "text-rose-600",
    fetch: async () => {
      const { data, error } = await supabase.from("v_produits").select("stock").eq("actif", true);
      if (error) throw error;
      const count = (data ?? []).filter((p) => Number(p.stock ?? 0) <= 5).length;
      return { value: String(count), sub: "≤ 5 unités" };
    },
  },
  commandes_ouvertes: {
    id: "commandes_ouvertes",
    title: "Commandes ouvertes",
    icon: ShoppingCart,
    accent: "text-indigo-600",
    fetch: async () => {
      const { count } = await supabase
        .from("commandes")
        .select("*", { count: "exact", head: true })
        .in("statut", ["brouillon", "confirmee"]);
      return { value: String(count ?? 0), sub: "à traiter" };
    },
  },
  paiements_recus_mois: {
    id: "paiements_recus_mois",
    title: "Paiements reçus",
    icon: BookOpenCheck,
    accent: "text-teal-600",
    fetch: async () => {
      const { data, error } = await supabase
        .from("paiements")
        .select("montant")
        .eq("statut", "valide")
        .gte("date_paiement", startOfMonthISO().slice(0, 10));
      if (error) throw error;
      const sum = (data ?? []).reduce((s, r) => s + Number(r.montant ?? 0), 0);
      return { value: formatFCFA(sum), sub: "ce mois" };
    },
  },
};

export const ALL_WIDGET_IDS = Object.keys(WIDGETS) as WidgetId[];

const SUBS: Record<WidgetId, string> = {
  clients_total: "total",
  produits_total: "référencés",
  factures_mois: "ce mois",
  ca_mois: "paiements validés",
  bl_en_cours: "non livrés",
  stock_faible: "≤ 5 unités",
  commandes_ouvertes: "à traiter",
  paiements_recus_mois: "ce mois",
};

const MONEY: WidgetId[] = ["ca_mois", "paiements_recus_mois"];

/**
 * Récupère toutes les valeurs de widgets via UNE seule RPC agrégée côté serveur.
 * Remplace 8 requêtes (dont 2 ramenant toutes les lignes de paiements) par un
 * unique aller-retour renvoyant des compteurs déjà calculés.
 * Repli automatique sur les requêtes unitaires si la RPC n'est pas disponible.
 */
/**
 * Récupère toutes les valeurs de widgets via UNE seule RPC agrégée côté serveur.
 * Remplace 8 requêtes par un unique aller-retour renvoyant des compteurs déjà calculés.
 */
export async function fetchAllWidgets(): Promise<Record<WidgetId, { value: string; sub?: string }>> {
  const { data, error } = await supabase.rpc("dashboard_widgets_all");
  
  if (!error && data && typeof data === "object") {
    const raw = data as Record<string, number | string>;
    return Object.fromEntries(
      ALL_WIDGET_IDS.map((id) => {
        const n = Number(raw[id] ?? 0);
        return [id, { value: MONEY.includes(id) ? formatFCFA(n) : String(n), sub: SUBS[id] }];
      }),
    ) as Record<WidgetId, { value: string; sub?: string }>;
  }

  // Fallback avec parallélisme si la RPC échoue ou n'est pas disponible
  const entries = await Promise.all(
    ALL_WIDGET_IDS.map(async (id) => {
      try {
        const res = await WIDGETS[id].fetch();
        return [id, res] as const;
      } catch (e) {
        console.error(`Widget ${id} fetch error:`, e);
        return [id, { value: "0", sub: SUBS[id] }] as const;
      }
    }),
  );
  return Object.fromEntries(entries) as Record<WidgetId, { value: string; sub?: string }>;
}


const STORAGE_KEY = "dashboard.widgets.v1";

export type DashboardPrefs = {
  order: WidgetId[];
  hidden: WidgetId[];
};

export function loadPrefs(): DashboardPrefs {
  if (typeof window === "undefined") return { order: ALL_WIDGET_IDS, hidden: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { order: ALL_WIDGET_IDS, hidden: [] };
    const parsed = JSON.parse(raw) as Partial<DashboardPrefs>;
    const known = new Set<WidgetId>(ALL_WIDGET_IDS);
    const order = (parsed.order ?? []).filter((id): id is WidgetId => known.has(id as WidgetId));
    for (const id of ALL_WIDGET_IDS) if (!order.includes(id)) order.push(id);
    const hidden = (parsed.hidden ?? []).filter((id): id is WidgetId => known.has(id as WidgetId));
    return { order, hidden };
  } catch {
    return { order: ALL_WIDGET_IDS, hidden: [] };
  }
}

export function savePrefs(prefs: DashboardPrefs) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
