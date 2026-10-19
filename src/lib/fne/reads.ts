import { attachClientIds } from "@/lib/facture-client-ids";
import { supabase } from "@/integrations/supabase/client";
import { loadFNESettings, isProductionReady } from "./settings";

export async function getFneFactureForFacture(factureId: string) {
  const { data } = await supabase
    .from("fne_factures")
    .select("*")
    .eq("facture_id", factureId)
    .maybeSingle();
  return data;
}

export async function listFNEInvoices(params: { statut?: string; limit?: number } = {}) {
  let q = supabase
    .from("fne_factures")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 100);
  if (params.statut) q = q.eq("statut", params.statut);
  const { data, error } = await q;
  if (error) throw error;
  return attachClientIds(data ?? []);
}

export async function getFNEInvoice(fneId: string) {
  const { data, error } = await supabase
    .from("fne_factures")
    .select("*")
    .eq("fne_id", fneId)
    .single();
  if (error) throw error;
  const [row] = await attachClientIds([data]);
  return row;
}

export async function listFNELogs(limit = 200) {
  const { data, error } = await supabase
    .from("fne_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export type FNEStats = {
  total: number;
  accepted: number;
  pending: number;
  submitted: number;
  rejected: number;
  error: number;
  success_rate: number;
  avg_processing_seconds: number;
};

export async function getFNEStats(): Promise<FNEStats> {
  const rows = await listFNEInvoices({ limit: 1000 });
  const counts: Record<string, number> = {
    total: rows.length,
    accepted: 0,
    pending: 0,
    submitted: 0,
    rejected: 0,
    error: 0,
  };
  let totalDuration = 0,
    durationN = 0;
  for (const r of rows) {
    const s = (r.statut ?? "pending") as string;
    counts[s] = (counts[s] ?? 0) + 1;
    if (s === "accepted" && r.submitted_at && r.validated_at) {
      const d = (new Date(r.validated_at).getTime() - new Date(r.submitted_at).getTime()) / 1000;
      if (Number.isFinite(d) && d >= 0) {
        totalDuration += d;
        durationN++;
      }
    }
  }
  const envoyees = counts.accepted + counts.submitted + counts.rejected + counts.error;
  const successRate =
    envoyees > 0 ? Math.max(0, Math.min(100, Math.round((counts.accepted / envoyees) * 100))) : 0;
  const avgProcessingSeconds = durationN ? Math.round(totalDuration / durationN) : 0;
  return {
    total: counts.total,
    accepted: counts.accepted,
    pending: counts.pending,
    submitted: counts.submitted,
    rejected: counts.rejected,
    error: counts.error,
    success_rate: successRate,
    avg_processing_seconds: avgProcessingSeconds,
  };
}

export async function getBalanceSticker(): Promise<{
  mode: "sandbox" | "production";
  balance: number;
  warning?: string;
  ncc?: string;
}> {
  const s = await loadFNESettings();
  if (!isProductionReady(s)) {
    return {
      mode: "sandbox",
      balance: 0,
      warning:
        "Mode sandbox actif — la clé API DGI n'est pas configurée. Le solde réel n'est pas disponible.",
      ncc: s.company_ncc,
    };
  }
  return {
    mode: "production",
    balance: 0,
    warning: "Appel /balance-sticker DGI non encore branché côté serveur.",
    ncc: s.company_ncc,
  };
}

export async function pingDGI(): Promise<{ ok: boolean; elapsed_ms: number; message: string }> {
  const t0 = Date.now();
  const s = await loadFNESettings();
  const url = s.use_production === "true" ? s.dgi_api_url_prod : s.dgi_api_url_test;
  if (!url) return { ok: false, elapsed_ms: 0, message: "URL DGI non configurée" };
  try {
    await fetch(url, { method: "HEAD", mode: "no-cors" });
    return {
      ok: true,
      elapsed_ms: Date.now() - t0,
      message: `Réponse réseau OK (no-cors) vers ${url}`,
    };
  } catch (e) {
    return { ok: false, elapsed_ms: Date.now() - t0, message: (e as Error).message };
  }
}
