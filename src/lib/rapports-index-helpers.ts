import { supabase } from "@/integrations/supabase/client";
import { exportPdf } from "@/lib/export-csv";
import { formatFCFA } from "@/lib/format";

export type Col = { key: string; label: string; money?: boolean; date?: boolean };

export type SummaryRow = { label: string; value: string };

export type ReportDef = {
  table: string;
  label: string;
  description: string;
  color: string;
  columns: Col[];
  fetcher?: (exerciceId: string | null) => Promise<Record<string, unknown>[]>;
  /**
   * Construit le récapitulatif final (nb enregistrements + totaux financiers)
   * à partir des lignes retournées par le fetcher. Reçoit uniquement les
   * lignes de données (pas les entêtes de groupe).
   */
  summary?: (rows: Record<string, unknown>[]) => SummaryRow[];
  /**
   * Permission RBAC requise pour afficher/générer ce rapport (optionnel).
   * Ex : "rapports.voir_ca" pour les rapports contenant du chiffre d'affaires.
   */
  permission?: string;
};

const fmtDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("fr-FR") : "");
export const fmtVal = (v: unknown, c: Col) => {
  if (v == null || v === "") return "";
  if (c.money) return formatFCFA(Number(v));
  if (c.date) return fmtDate(v);
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  return String(v);
};

export const EXERCICE_SCOPED = new Set([
  "achats",
  "bons_livraison",
  "bons_retour",
  "bulletins_paie",
  "commandes",
  "ecritures_comptables",
  "factures",
  "inventaires",
  "paiements",
  "proformas",
  "retours",
  "stock_mouvements",
  "transactions",
]);

export async function fetchReportRows(
  def: ReportDef,
  exerciceId: string | null,
): Promise<Record<string, unknown>[]> {
  if (def.fetcher) return def.fetcher(exerciceId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase.from(def.table as any) as any).select("*");
  if (exerciceId && EXERCICE_SCOPED.has(def.table)) {
    q = q.eq("exercice_id", exerciceId);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Record<string, unknown>[];
}

export function exportReportPdf(def: ReportDef, rows: Record<string, unknown>[]) {
  const headers = def.columns.map((c) => c.label);
  const body = rows.map((r) => {
    if (r.__group__ != null) {
      return [
        {
          content: String(r.__group__),
          colSpan: def.columns.length,
          styles: {
            fillColor: [255, 255, 255] as [number, number, number],
            textColor: [0, 0, 0] as [number, number, number],
            fontStyle: "bold" as const,
            halign: "left" as const,
            cellPadding: { top: 4, bottom: 2, left: 0, right: 0 },
          },
        },
      ];
    }
    return def.columns.map((c) => fmtVal(r[c.key], c));
  });

  // Récapitulatif : nombre d'enregistrements réels + totaux personnalisés
  const dataRows = rows.filter((r) => r.__group__ == null);
  const baseSummary: SummaryRow[] = [
    { label: "Nombre d'enregistrements", value: String(dataRows.length) },
  ];
  const extra = def.summary ? def.summary(dataRows) : [];
  const summary = [...baseSummary, ...extra];

  exportPdf(def.label, headers, body, { summary, pageTitle: def.label });
}
