import { pgSafe } from "@/lib/postgrest-filter";
import { supabase } from "@/integrations/supabase/client";

export const TYPES_TRANSACTION = [
  { value: "recette", label: "Recette", color: "#10B981" },
  { value: "depense", label: "Dépense", color: "#EF4444" },
] as const;

export const TYPE_TRANSACTION_LABEL: Record<string, { label: string; color: string }> =
  Object.fromEntries(TYPES_TRANSACTION.map((t) => [t.value, { label: t.label, color: t.color }]));

export const CATEGORIES_TRANSACTION = [
  { value: "vente", label: "Vente" },
  { value: "achat", label: "Achat" },
  { value: "salaire", label: "Salaire" },
  { value: "loyer", label: "Loyer" },
  { value: "transport", label: "Transport" },
  { value: "fournitures", label: "Fournitures" },
  { value: "impots", label: "Impôts / Taxes" },
  { value: "autre", label: "Autre" },
] as const;

export const CATEGORIE_TRANSACTION_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES_TRANSACTION.map((c) => [c.value, c.label]),
);

export const MODES_PAIEMENT = [
  { value: "especes", label: "Espèces" },
  { value: "virement", label: "Virement" },
  { value: "cheque", label: "Chèque" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "carte", label: "Carte bancaire" },
] as const;

export const MODE_PAIEMENT_LABEL: Record<string, string> = Object.fromEntries(
  MODES_PAIEMENT.map((m) => [m.value, m.label]),
);

export const STATUTS_TRANSACTION = [
  { value: "valide", label: "Validé", color: "#10B981" },
  { value: "en_attente", label: "En attente", color: "#F97316" },
  { value: "annule", label: "Annulé", color: "#94A3B8" },
] as const;

export const STATUT_TRANSACTION_LABEL: Record<string, { label: string; color: string }> =
  Object.fromEntries(STATUTS_TRANSACTION.map((s) => [s.value, { label: s.label, color: s.color }]));

export type Transaction = {
  transaction_id: string;
  reference: string;
  type: string;
  categorie: string;
  libelle: string;
  montant: number;
  mode_paiement: string;
  statut: string;
  date_transaction: string;
  commande_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type TransactionInput = {
  type: string;
  categorie: string;
  libelle: string;
  montant: number;
  mode_paiement: string;
  statut: string;
  date_transaction: string;
  notes?: string | null;
};

export async function listTransactions(q?: string, type?: string, exerciceId?: string | null) {
  let query = supabase.from("transactions").select("*");
  if (exerciceId) query = query.eq("exercice_id", exerciceId);
  if (q) query = query.or(`libelle.ilike.%${pgSafe(q)}%,reference.ilike.%${pgSafe(q)}%`);
  if (type) query = query.eq("type", type);
  query = query
    .order("date_transaction", { ascending: false })
    .order("created_at", { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Transaction[];
}

export async function createTransaction(input: TransactionInput) {
  const { data, error } = await supabase.from("transactions").insert(input).select().single();
  if (error) throw error;
  return data as Transaction;
}

export async function updateTransaction(id: string, input: TransactionInput) {
  const { data, error } = await supabase
    .from("transactions")
    .update(input)
    .eq("transaction_id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Transaction;
}

export async function deleteTransaction(id: string) {
  const { error } = await supabase.from("transactions").delete().eq("transaction_id", id);
  if (error) throw error;
}
