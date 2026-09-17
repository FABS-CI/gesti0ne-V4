import { supabase } from "@/integrations/supabase/client";

import { formatFCFA, formatDate } from "@/lib/format";
export type Notification = {
  notification_id: string;
  titre: string;
  message: string | null;
  type_notification: string;
  lu: boolean;
  date_notification: string;
  created_at: string;
  updated_at: string;
  user_id?: string | null;
  is_super_admin?: boolean | null;
  role_cible?: string | null;
  module?: string | null;
  document_type?: string | null;
  document_id?: string | null;
  document_reference?: string | null;
  lien?: string | null;
  priorite?: string | null;
  metadata?: any;
};

export type TypeNotif = "info" | "succes" | "alerte" | "erreur";

export const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  info: { label: "Info", color: "#3B82F6" },
  succes: { label: "Succès", color: "#10B981" },
  alerte: { label: "Alerte", color: "#F97316" },
  erreur: { label: "Erreur", color: "#EF4444" },
};

export async function listNotifications(opts?: {
  type?: string;
  lu?: boolean;
  limit?: number;
}): Promise<Notification[]> {
  let q = supabase
    .from("notifications")
    .select("*")
    .order("date_notification", { ascending: false })
    .order("created_at", { ascending: false });
  if (opts?.type) q = q.eq("type_notification", opts.type);
  if (typeof opts?.lu === "boolean") q = q.eq("lu", opts.lu);
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Notification[];
}

export async function countUnread(): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("notification_id", { count: "exact", head: true })
    .eq("lu", false);
  if (error) throw error;
  return count ?? 0;
}

export async function markAsRead(id: string, lu = true): Promise<void> {
  const { error } = await supabase.from("notifications").update({ lu }).eq("notification_id", id);
  if (error) throw error;
}

export async function markAllAsRead(): Promise<void> {
  const { error } = await supabase.from("notifications").update({ lu: true }).eq("lu", false);
  if (error) throw error;
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase.from("notifications").delete().eq("notification_id", id);
  if (error) throw error;
}

export async function deleteAllRead(): Promise<void> {
  const { assertPermission } = await import("@/lib/rbac-api");
  await assertPermission("notifications.purger");
  const { error } = await supabase.from("notifications").delete().eq("lu", true);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// Génération automatique d'alertes métier
// ─────────────────────────────────────────────────────────────────────────────

type AlerteCandidate = {
  titre: string;
  message: string;
  type_notification: TypeNotif;
};

async function computeAlertes(): Promise<AlerteCandidate[]> {
  const alertes: AlerteCandidate[] = [];
  const today = new Date().toISOString().slice(0, 10);

  // 1. Factures impayées avec échéance dépassée
  const { data: factures } = await supabase
    .from("factures")
    .select("reference, client_nom, montant_total, montant_paye, date_echeance, statut")
    .in("statut", ["impayee", "partielle"]);
  for (const f of factures ?? []) {
    if (!f.date_echeance || f.date_echeance >= today) continue;
    const reste = Number(f.montant_total ?? 0) - Number(f.montant_paye ?? 0);
    if (reste <= 0) continue;
    alertes.push({
      titre: `Facture en retard — ${f.reference}`,
      message: `${f.client_nom ?? "Client"} • échéance ${formatDate(f.date_echeance)} • reste ${formatFCFA(Math.round(
        reste,
      ), false)} FCFA`,
      type_notification: "erreur",
    });
  }

  // 2. Stock faible (sous seuil d'alerte) ou rupture
  const { data: produits } = await supabase
    .from("v_produits")
    .select("titre, stock, seuil_alerte, actif")
    .neq("actif", false);
  for (const p of produits ?? []) {
    const stock = Number(p.stock ?? 0);
    const seuil = Number(p.seuil_alerte ?? 0);
    if (stock <= 0) {
      alertes.push({
        titre: `Rupture de stock — ${p.titre}`,
        message: `Stock épuisé`,
        type_notification: "erreur",
      });
    } else if (seuil > 0 && stock <= seuil) {
      alertes.push({
        titre: `Stock faible — ${p.titre}`,
        message: `Stock ${stock} ≤ seuil ${seuil}`,
        type_notification: "alerte",
      });
    }
  }

  // 3. Congés en attente
  const { data: conges } = await supabase
    .from("conges")
    .select("conge_id, date_debut, date_fin, statut, employes(nom_complet)")
    .eq("statut", "en_attente");
  for (const c of (conges ?? []) as Array<{
    conge_id: string;
    date_debut: string;
    date_fin: string;
    employes?: { nom_complet?: string | null } | null;
  }>) {
    const nom = c.employes?.nom_complet ?? "Employé";
    alertes.push({
      titre: `Congé à valider — ${nom}`,
      message: `Du ${formatDate(c.date_debut)} au ${formatDate(c.date_fin)}`,
      type_notification: "alerte",
    });
  }

  // 4. Contrats expirant dans 30 jours
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const limit = in30.toISOString().slice(0, 10);
  const { data: contrats } = await supabase
    .from("contrats")
    .select("employe_nom, type, date_fin, statut")
    .not("date_fin", "is", null)
    .gte("date_fin", today)
    .lte("date_fin", limit);
  for (const c of contrats ?? []) {
    if (c.statut && c.statut !== "actif") continue;
    alertes.push({
      titre: `Contrat expirant — ${c.employe_nom ?? ""}`,
      message: `${c.type ?? "Contrat"} se termine le ${formatDate(c.date_fin)}`,
      type_notification: "alerte",
    });
  }

  // 5. Véhicules — entretien / assurance / visite technique dans 30 jours
  const { data: vehicules } = await supabase
    .from("vehicules")
    .select(
      "immatriculation, date_prochain_entretien, date_expiration_assurance, date_expiration_visite_technique",
    );
  for (const v of vehicules ?? []) {
    const imm = v.immatriculation ?? "Véhicule";
    const check = (label: string, date: string | null, niveau: TypeNotif) => {
      if (!date || date > limit) return;
      alertes.push({
        titre: `${label} — ${imm}`,
        message: date < today ? `Expiré le ${date}` : `Échéance ${date}`,
        type_notification: date < today ? "erreur" : niveau,
      });
    };
    check("Entretien véhicule", v.date_prochain_entretien, "alerte");
    check("Assurance véhicule", v.date_expiration_assurance, "alerte");
    check("Visite technique", v.date_expiration_visite_technique, "alerte");
  }

  // 6. Tournées avec coût total anormalement élevé (> 200 000 FCFA)
  const { data: tournees } = await supabase
    .from("tournees")
    .select("reference, date_tournee, cout_total, statut")
    .gt("cout_total", 200000)
    .order("date_tournee", { ascending: false })
    .limit(20);
  for (const t of tournees ?? []) {
    alertes.push({
      titre: `Tournée coût élevé — ${t.reference}`,
      message: `${t.date_tournee ?? ""} • ${formatFCFA(Math.round(Number(t.cout_total ?? 0)), false)} FCFA`,
      type_notification: "alerte",
    });
  }

  return alertes;
}

/**
 * Génère les alertes métier et les insère comme notifications.
 * Déduplique par titre : si une notification non lue avec le même titre
 * existe déjà, on ne la recrée pas.
 */
export async function genererAlertes(): Promise<{
  created: number;
  skipped: number;
}> {
  const { assertPermission } = await import("@/lib/rbac-api");
  await assertPermission("notifications.generer");
  const rawCandidates = await computeAlertes();
  // Déduplication interne : si computeAlertes remonte plusieurs alertes avec
  // le même titre (ex : produits homonymes), on ne garde que la première.
  const seenTitres = new Set<string>();
  const candidates = rawCandidates.filter((c) => {
    if (seenTitres.has(c.titre)) return false;
    seenTitres.add(c.titre);
    return true;
  });
  if (candidates.length === 0) return { created: 0, skipped: 0 };

  const titres = candidates.map((c) => c.titre);
  const { data: existants } = await supabase
    .from("notifications")
    .select("titre")
    .eq("lu", false)
    .in("titre", titres);
  const seen = new Set((existants ?? []).map((e) => e.titre));

  const toInsert = candidates.filter((c) => !seen.has(c.titre));
  if (toInsert.length === 0) return { created: 0, skipped: candidates.length };

  const today = new Date().toISOString().slice(0, 10);
  
  // RÈGLE ABSOLUE : Vérification Super Admin avant insertion
  const { isSuperAdminAction } = await import("@/lib/auth/super-admin-check");
  if (await isSuperAdminAction()) return { created: 0, skipped: candidates.length };

  const rows = toInsert.map((c) => ({
    titre: c.titre,
    message: c.message,
    type_notification: c.type_notification,
    date_notification: today,
    lu: false,
  }));
  const { error } = await supabase.from("notifications").insert(rows);
  if (error) throw error;
  return { created: rows.length, skipped: candidates.length - rows.length };
}
