import {
  Users,
  ShoppingCart,
  Package,
  Wallet,
  FileText,
  CreditCard,
  Truck,
  UserCog,
  Factory,
  Warehouse,
  ClipboardList,
  FileSpreadsheet,
  Receipt,
  BookOpen,
  Banknote,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatFCFA } from "@/lib/format";
import type { ReportDef, SummaryRow } from "./rapports-index-helpers";

// ------- Helpers de résolution FK -------
async function loadDepotNames(): Promise<Map<string, string>> {
  const { data } = await supabase.from("depots").select("depot_id, nom, code");
  const m = new Map<string, string>();
  for (const d of (data ?? []) as Array<{ depot_id: string; nom: string | null; code: string | null }>) {
    m.set(d.depot_id, d.nom || d.code || d.depot_id.slice(0, 8));
  }
  return m;
}

async function loadProduitInfos(): Promise<
  Map<string, { titre: string; reference: string; prix: number }>
> {
  const { data } = await supabase
    .from("produits")
    .select("produit_id, titre, reference, prix_vente");
  const m = new Map<string, { titre: string; reference: string; prix: number }>();
  for (const p of (data ?? []) as Array<{
    produit_id: string;
    titre: string | null;
    reference: string | null;
    prix_vente: number | null;
  }>) {
    m.set(p.produit_id, {
      titre: p.titre ?? "—",
      reference: p.reference ?? "",
      prix: Number(p.prix_vente ?? 0),
    });
  }
  return m;
}

async function loadEmployeNames(): Promise<Map<string, string>> {
  const { data } = await supabase.from("employes").select("employe_id, matricule, nom_complet");
  const m = new Map<string, string>();
  for (const e of (data ?? []) as Array<{
    employe_id: string;
    matricule: string | null;
    nom_complet: string | null;
  }>) {
    m.set(e.employe_id, e.nom_complet ?? e.matricule ?? "—");
  }
  return m;
}

// ------- Sommateurs génériques -------
const sum = (rows: Record<string, unknown>[], key: string) =>
  rows.reduce((acc, r) => acc + Number(r[key] ?? 0), 0);

const countStatut = (rows: Record<string, unknown>[], statuts: string[]) =>
  rows.filter((r) => statuts.includes(String(r.statut ?? "").toLowerCase())).length;

export const REPORTS: ReportDef[] = [
  {
    table: "clients",
    permission: "rapports.voir_ca",
    label: "Liste des Clients",
    description: "Annuaire clients groupé par ville",
    icon: Users,
    color: "#3B82F6",
    columns: [
      { key: "nom", label: "Client" },
      { key: "telephone", label: "Téléphone" },
      { key: "representant", label: "Représentant" },
      { key: "email", label: "Email" },
      { key: "type_client", label: "Type" },
      { key: "plafond_credit", label: "Plafond", money: true },
      { key: "solde", label: "Solde dû", money: true },
    ],
    fetcher: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("nom, telephone, representant, email, type_client, ville, plafond_credit, solde")
        .order("ville", { ascending: true })
        .order("nom", { ascending: true })
        .range(0, 9999);
      if (error) throw error;
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      const out: Array<Record<string, unknown>> = [];
      let current = "__INIT__";
      for (const r of rows) {
        const v = (r.ville as string) || "—";
        if (v !== current) {
          out.push({ __group__: v.toUpperCase() });
          current = v;
        }
        out.push(r);
      }
      return out;
    },
    summary: (rows) => [
      { label: "Total solde dû (FCFA)", value: formatFCFA(sum(rows, "solde")) },
      { label: "Clients débiteurs", value: String(rows.filter((r) => Number(r.solde ?? 0) > 0).length) },
    ],
  },

  {
    table: "commandes",
    permission: "rapports.voir_ca",
    label: "Commandes",
    description: "Toutes les commandes",
    icon: ShoppingCart,
    color: "#F97316",
    columns: [
      { key: "reference", label: "Référence" },
      { key: "date_commande", label: "Date", date: true },
      { key: "client_nom", label: "Client" },
      { key: "commercial_nom", label: "Commercial" },
      { key: "statut", label: "Statut" },
      { key: "nb_produits", label: "Nb art." },
      { key: "montant_total", label: "Montant TTC", money: true },
    ],
    fetcher: async (exerciceId) => {
      let q = supabase
        .from("commandes")
        .select(
          "reference, date_commande, client_nom, commercial_nom, statut, nb_produits, montant_total",
        )
        .order("date_commande", { ascending: false });
      if (exerciceId) q = q.eq("exercice_id", exerciceId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    summary: (rows) => [
      { label: "Total montant TTC (FCFA)", value: formatFCFA(sum(rows, "montant_total")) },
      { label: "Commandes validées", value: String(countStatut(rows, ["validee", "validée", "valide"])) },
      { label: "Commandes annulées", value: String(countStatut(rows, ["annulee", "annulée"])) },
    ],
  },

  {
    table: "produits",
    label: "Produits",
    description: "Catalogue produits & stock",
    icon: Package,
    color: "#10B981",
    columns: [
      { key: "reference", label: "Code Article" },
      { key: "isbn", label: "ISBN" },
      { key: "titre", label: "Désignation" },
      { key: "categorie", label: "Catégorie" },
      { key: "niveau", label: "Niveau" },
      { key: "matiere", label: "Matière" },
      { key: "prix_vente", label: "Prix vente (FCFA)", money: true },
      { key: "stock", label: "Stock" },
      { key: "seuil_alerte", label: "Seuil" },
    ],
    fetcher: async () => {
      const { data, error } = await supabase
        .from("v_produits")
        .select(
          "reference, isbn, titre, categorie, niveau, matiere, editeur, prix_achat, prix_vente, stock, seuil_alerte",
        )
        .order("pin_order", { ascending: true })
        .order("niveau_ordre", { ascending: true })
        .order("titre", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    summary: (rows) => {
      const stockTotal = sum(rows, "stock");
      const valorisation = rows.reduce(
        (acc, r) => acc + Number(r.stock ?? 0) * Number(r.prix_vente ?? 0),
        0,
      );
      const alertes = rows.filter(
        (r) => Number(r.stock ?? 0) <= Number(r.seuil_alerte ?? 0),
      ).length;
      return [
        { label: "Stock total (unités)", value: String(stockTotal) },
        { label: "Valorisation stock (FCFA)", value: formatFCFA(valorisation) },
        { label: "Produits sous seuil", value: String(alertes) },
      ];
    },
  },

  {
    table: "transactions",
    permission: "rapports.voir_ca",
    label: "Comptabilité — Recettes et dépenses",
    description: "Recettes et dépenses",
    icon: Wallet,
    color: "#8B5CF6",
    columns: [
      { key: "reference", label: "Réf." },
      { key: "date_transaction", label: "Date", date: true },
      { key: "type", label: "Type" },
      { key: "categorie", label: "Catégorie" },
      { key: "libelle", label: "Libellé" },
      { key: "mode_paiement", label: "Mode" },
      { key: "montant", label: "Montant", money: true },
    ],
    fetcher: async (exerciceId) => {
      let q = supabase
        .from("transactions")
        .select("reference, date_transaction, type, categorie, libelle, mode_paiement, montant")
        .order("date_transaction", { ascending: false });
      if (exerciceId) q = q.eq("exercice_id", exerciceId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    summary: (rows) => {
      const recettes = rows
        .filter((r) => String(r.type ?? "").toLowerCase() === "recette")
        .reduce((a, r) => a + Number(r.montant ?? 0), 0);
      const depenses = rows
        .filter((r) => String(r.type ?? "").toLowerCase() === "depense")
        .reduce((a, r) => a + Number(r.montant ?? 0), 0);
      return [
        { label: "Total recettes (FCFA)", value: formatFCFA(recettes) },
        { label: "Total dépenses (FCFA)", value: formatFCFA(depenses) },
        { label: "Solde net (FCFA)", value: formatFCFA(recettes - depenses) },
      ];
    },
  },

  {
    table: "factures",
    permission: "rapports.voir_ca",
    label: "Factures",
    description: "Facturation clients",
    icon: FileText,
    color: "#EF4444",
    columns: [
      { key: "reference", label: "Référence" },
      { key: "date_facture", label: "Date", date: true },
      { key: "date_echeance", label: "Échéance", date: true },
      { key: "client_nom", label: "Client" },
      { key: "statut", label: "Statut" },
      { key: "montant_total", label: "Montant TTC", money: true },
      { key: "montant_paye", label: "Payé", money: true },
      { key: "reste", label: "Reste à payer", money: true },
    ],
    fetcher: async (exerciceId) => {
      let q = supabase
        .from("factures")
        .select(
          "reference, date_facture, date_echeance, client_nom, statut, montant_total, montant_paye",
        )
        .order("date_facture", { ascending: false });
      if (exerciceId) q = q.eq("exercice_id", exerciceId);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        ...r,
        reste: Number(r.montant_total ?? 0) - Number(r.montant_paye ?? 0),
      }));
    },
    summary: (rows) => {
      const tot = sum(rows, "montant_total");
      const paye = sum(rows, "montant_paye");
      return [
        { label: "Total facturé (FCFA)", value: formatFCFA(tot) },
        { label: "Total encaissé (FCFA)", value: formatFCFA(paye) },
        { label: "Reste à recouvrer (FCFA)", value: formatFCFA(tot - paye) },
      ];
    },
  },

  {
    table: "paiements",
    permission: "rapports.voir_ca",
    label: "Paiements",
    description: "Encaissements",
    icon: CreditCard,
    color: "#14B8A6",
    columns: [
      { key: "reference", label: "Référence" },
      { key: "date_paiement", label: "Date", date: true },
      { key: "client_nom", label: "Client" },
      { key: "facture_reference", label: "Facture" },
      { key: "mode_paiement", label: "Mode" },
      { key: "statut", label: "Statut" },
      { key: "montant", label: "Montant", money: true },
    ],
    fetcher: async (exerciceId) => {
      let q = supabase
        .from("paiements")
        .select(
          "reference, date_paiement, client_nom, mode_paiement, statut, montant, facture:factures(reference)",
        )
        .order("date_paiement", { ascending: false });
      if (exerciceId) q = q.eq("exercice_id", exerciceId);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        reference: r.reference,
        date_paiement: r.date_paiement,
        client_nom: r.client_nom,
        mode_paiement: r.mode_paiement,
        statut: r.statut,
        montant: r.montant,
        facture_reference:
          (r.facture as { reference?: string } | null)?.reference ?? "",
      }));
    },
    summary: (rows) => {
      const encaisse = rows
        .filter((r) => String(r.statut ?? "").toLowerCase() !== "annule")
        .reduce((a, r) => a + Number(r.montant ?? 0), 0);
      const annule = rows
        .filter((r) => String(r.statut ?? "").toLowerCase() === "annule")
        .reduce((a, r) => a + Number(r.montant ?? 0), 0);
      return [
        { label: "Total encaissé (FCFA)", value: formatFCFA(encaisse) },
        { label: "Total annulé (FCFA)", value: formatFCFA(annule) },
      ];
    },
  },

  {
    table: "achats",
    permission: "rapports.voir_ca",
    label: "Achats",
    description: "Bons de commande fournisseurs",
    icon: Truck,
    color: "#F59E0B",
    columns: [
      { key: "reference", label: "Référence" },
      { key: "date_achat", label: "Date", date: true },
      { key: "fournisseur_nom", label: "Fournisseur" },
      { key: "libelle", label: "Libellé" },
      { key: "statut", label: "Statut" },
      { key: "total_quantite", label: "Quantité" },
      { key: "montant", label: "Montant", money: true },
    ],
    fetcher: async (exerciceId) => {
      let q = supabase
        .from("achats")
        .select("reference, date_achat, fournisseur_nom, libelle, statut, total_quantite, montant")
        .order("date_achat", { ascending: false });
      if (exerciceId) q = q.eq("exercice_id", exerciceId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    summary: (rows) => [
      { label: "Total achats (FCFA)", value: formatFCFA(sum(rows, "montant")) },
      { label: "Quantité totale", value: String(sum(rows, "total_quantite")) },
    ],
  },

  {
    table: "employes",
    label: "Employés",
    description: "Registre du personnel",
    icon: UserCog,
    color: "#6366F1",
    columns: [
      { key: "matricule", label: "Matricule" },
      { key: "nom_complet", label: "Nom complet" },
      { key: "poste", label: "Poste" },
      { key: "departement", label: "Département" },
      { key: "telephone", label: "Téléphone" },
      { key: "email", label: "Email" },
      { key: "date_embauche", label: "Embauche", date: true },
      { key: "actif", label: "Actif" },
    ],
    fetcher: async () => {
      const { data, error } = await supabase
        .from("employes")
        .select("matricule, nom_complet, poste, departement, telephone, email, date_embauche, actif")
        .order("nom_complet", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    summary: (rows) => [
      { label: "Employés actifs", value: String(rows.filter((r) => r.actif).length) },
      { label: "Employés inactifs", value: String(rows.filter((r) => !r.actif).length) },
    ],
  },

  {
    table: "fournisseurs",
    label: "Fournisseurs",
    description: "Annuaire des fournisseurs",
    icon: Factory,
    color: "#0EA5E9",
    columns: [
      { key: "raison_sociale", label: "Raison sociale" },
      { key: "representant", label: "Représentant" },
      { key: "telephone", label: "Téléphone" },
      { key: "email", label: "Email" },
      { key: "ville", label: "Ville" },
      { key: "adresse", label: "Adresse" },
      { key: "actif", label: "Actif" },
    ],
    fetcher: async () => {
      const { data, error } = await supabase
        .from("fournisseurs")
        .select("raison_sociale, representant, telephone, email, ville, adresse, actif")
        .order("raison_sociale", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    summary: (rows) => [
      { label: "Fournisseurs actifs", value: String(rows.filter((r) => r.actif).length) },
    ],
  },

  {
    table: "proformas",
    permission: "rapports.voir_ca",
    label: "Devis / Proformas",
    description: "Devis et proformas émis",
    icon: FileSpreadsheet,
    color: "#A855F7",
    columns: [
      { key: "reference", label: "Référence" },
      { key: "date_proforma", label: "Date", date: true },
      { key: "date_validite", label: "Validité", date: true },
      { key: "client_nom", label: "Client" },
      { key: "statut", label: "Statut" },
      { key: "montant_total", label: "Montant TTC", money: true },
    ],
    fetcher: async (exerciceId) => {
      let q = supabase
        .from("proformas")
        .select("reference, date_proforma, date_validite, client_nom, statut, montant_total")
        .order("date_proforma", { ascending: false });
      // Pas de colonne exercice_id sur proformas : filtre par dates de l'exercice.
      if (exerciceId) {
        const { data: ex } = await supabase
          .from("exercices")
          .select("date_debut, date_fin")
          .eq("exercice_id", exerciceId)
          .maybeSingle();
        if (ex?.date_debut) q = q.gte("date_proforma", ex.date_debut);
        if (ex?.date_fin) q = q.lte("date_proforma", ex.date_fin);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    summary: (rows) => [
      { label: "Montant total", value: formatFCFA(sum(rows, "montant_total")) },
    ],
  },

  {
    table: "bons_livraison",
    label: "Bons de livraison",
    description: "BL émis",
    icon: Truck,
    color: "#22C55E",
    columns: [
      { key: "reference", label: "Référence" },
      { key: "date_emission", label: "Émission", date: true },
      { key: "date_livraison", label: "Livraison", date: true },
      { key: "client_nom", label: "Client" },
      { key: "transporteur", label: "Transporteur" },
      { key: "statut", label: "Statut" },
      { key: "montant", label: "Montant", money: true },
    ],
    fetcher: async (exerciceId) => {
      let q = supabase
        .from("bons_livraison")
        .select(
          "reference, date_emission, date_livraison, client_nom, transporteur, statut, montant",
        )
        .order("date_emission", { ascending: false });
      if (exerciceId) q = q.eq("exercice_id", exerciceId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    summary: (rows) => [
      { label: "Total livré (FCFA)", value: formatFCFA(sum(rows, "montant")) },
      { label: "BL livrés", value: String(countStatut(rows, ["livre", "livré", "livree", "livrée"])) },
    ],
  },

  {
    table: "stocks_depots",
    label: "Stocks",
    description: "Niveaux de stock par dépôt",
    icon: Warehouse,
    color: "#0D9488",
    columns: [
      { key: "produit_reference", label: "Réf." },
      { key: "produit_titre", label: "Désignation" },
      { key: "depot_nom", label: "Dépôt" },
      { key: "quantite", label: "Stock disponible" },
      { key: "seuil_alerte", label: "Seuil" },
      { key: "valorisation", label: "Valorisation", money: true },
      { key: "alerte", label: "Alerte" },
    ],
    fetcher: async () => {
      const [{ data, error }, depots, prods] = await Promise.all([
        supabase.from("stocks_depots").select("produit_id, depot_id, quantite, seuil_alerte"),
        loadDepotNames(),
        loadProduitInfos(),
      ]);
      if (error) throw error;
      const rows = ((data ?? []) as Array<{
        produit_id: string;
        depot_id: string;
        quantite: number | null;
        seuil_alerte: number | null;
      }>).map((r) => {
        const p = prods.get(r.produit_id);
        const q = Number(r.quantite ?? 0);
        const s = Number(r.seuil_alerte ?? 0);
        return {
          produit_reference: p?.reference ?? "",
          produit_titre: p?.titre ?? r.produit_id.slice(0, 8),
          depot_nom: depots.get(r.depot_id) ?? "—",
          quantite: q,
          seuil_alerte: s,
          valorisation: q * (p?.prix ?? 0),
          alerte: q <= s ? "! Sous seuil" : "",
        } as Record<string, unknown>;
      });
      rows.sort((a, b) =>
        String(a.depot_nom).localeCompare(String(b.depot_nom)) ||
        String(a.produit_titre).localeCompare(String(b.produit_titre)),
      );
      return rows;
    },
    summary: (rows) => [
      { label: "Quantité totale (unités)", value: String(sum(rows, "quantite")) },
      { label: "Valorisation totale (FCFA)", value: formatFCFA(sum(rows, "valorisation")) },
      {
        label: "Lignes en alerte",
        value: String(rows.filter((r) => String(r.alerte ?? "").length > 0).length),
      },
    ],
  },

  {
    table: "inventaires",
    label: "Inventaires",
    description: "Inventaires physiques",
    icon: ClipboardList,
    color: "#D97706",
    columns: [
      { key: "reference", label: "Référence" },
      { key: "depot_nom", label: "Dépôt" },
      { key: "date_inventaire", label: "Date", date: true },
      { key: "ecart_total", label: "Écart total" },
      { key: "statut", label: "Statut" },
    ],
    fetcher: async (exerciceId) => {
      const [{ data, error }, depots] = await Promise.all([
        (() => {
          let q = supabase
            .from("inventaires")
            .select("reference, depot_id, date_inventaire, ecart_total, statut")
            .order("date_inventaire", { ascending: false });
          if (exerciceId) q = q.eq("exercice_id", exerciceId);
          return q;
        })(),
        loadDepotNames(),
      ]);
      if (error) throw error;
      return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        ...r,
        depot_nom: depots.get(String(r.depot_id ?? "")) ?? "—",
      }));
    },
    summary: (rows) => [
      { label: "Écart cumulé (unités)", value: String(sum(rows, "ecart_total")) },
      { label: "Inventaires clôturés", value: String(countStatut(rows, ["cloture", "clôturé", "cloturee"])) },
    ],
  },

  {
    table: "etat_compte",
    permission: "rapports.voir_ca",
    label: "État de compte clients",
    description: "Solde par client (factures)",
    icon: Receipt,
    color: "#DC2626",
    columns: [
      { key: "client_nom", label: "Client" },
      { key: "nb_factures", label: "Nb factures" },
      { key: "total_facture", label: "Total facturé", money: true },
      { key: "total_paye", label: "Total payé", money: true },
      { key: "solde", label: "Solde dû", money: true },
    ],
    fetcher: async (exerciceId) => {
      let q = supabase.from("factures").select("client_nom, montant_total, montant_paye");
      if (exerciceId) q = q.eq("exercice_id", exerciceId);
      const { data, error } = await q;
      if (error) throw error;
      const map = new Map<string, { nb: number; tot: number; paye: number }>();
      for (const f of (data ?? []) as Array<{
        client_nom: string | null;
        montant_total: number | null;
        montant_paye: number | null;
      }>) {
        const k = f.client_nom ?? "—";
        const cur = map.get(k) ?? { nb: 0, tot: 0, paye: 0 };
        cur.nb += 1;
        cur.tot += Number(f.montant_total ?? 0);
        cur.paye += Number(f.montant_paye ?? 0);
        map.set(k, cur);
      }
      return Array.from(map.entries())
        .map(([client_nom, v]) => ({
          client_nom,
          nb_factures: v.nb,
          total_facture: v.tot,
          total_paye: v.paye,
          solde: v.tot - v.paye,
        }))
        .sort((a, b) => b.solde - a.solde);
    },
    summary: (rows) => {
      const tot = sum(rows, "total_facture");
      const paye = sum(rows, "total_paye");
      const solde = sum(rows, "solde");
      return [
        { label: "Total facturé (FCFA)", value: formatFCFA(tot) },
        { label: "Total encaissé (FCFA)", value: formatFCFA(paye) },
        { label: "Solde total dû (FCFA)", value: formatFCFA(solde) },
        {
          label: "Clients débiteurs",
          value: String(rows.filter((r) => Number(r.solde ?? 0) > 0).length),
        },
      ];
    },
  },

  {
    table: "ecritures_comptables",
    permission: "rapports.voir_ca",
    label: "Comptabilité — Écritures comptables",
    description: "Écritures comptables",
    icon: BookOpen,
    color: "#7C3AED",
    columns: [
      { key: "reference", label: "Référence" },
      { key: "date_ecriture", label: "Date", date: true },
      { key: "journal", label: "Journal" },
      { key: "piece_ref", label: "Pièce" },
      { key: "libelle", label: "Libellé" },
      { key: "lettrage", label: "Lettrage" },
      { key: "statut", label: "Statut" },
      { key: "montant", label: "Montant", money: true },
    ],
    fetcher: async (exerciceId) => {
      let q = supabase
        .from("ecritures_comptables")
        .select("reference, date_ecriture, journal, piece_ref, libelle, lettrage, statut, montant")
        .order("date_ecriture", { ascending: false });
      if (exerciceId) q = q.eq("exercice_id", exerciceId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    summary: (rows) => [
      { label: "Total montant (FCFA)", value: formatFCFA(sum(rows, "montant")) },
      { label: "Écritures lettrées", value: String(rows.filter((r) => r.lettrage).length) },
    ],
  },

  {
    table: "bulletins_paie",
    permission: "rapports.voir_ca",
    label: "Bulletins de paie",
    description: "Bulletins RH",
    icon: Banknote,
    color: "#EC4899",
    columns: [
      { key: "reference", label: "Référence" },
      { key: "employe_nom", label: "Employé" },
      { key: "periode", label: "Période" },
      { key: "date_bulletin", label: "Date", date: true },
      { key: "salaire_brut", label: "Brut", money: true },
      { key: "cotisations", label: "Retenues", money: true },
      { key: "salaire_net", label: "Net", money: true },
      { key: "statut", label: "Statut" },
    ],
    fetcher: async () => {
      const [{ data, error }, employes] = await Promise.all([
        (() => {
          return supabase
            .from("bulletins_paie")
            .select(
              "reference, employe_id, periode, date_bulletin, salaire_brut, cotisations, salaire_net, statut",
            )
            .order("date_bulletin", { ascending: false });
        })(),
        loadEmployeNames(),
      ]);
      if (error) throw error;
      return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        ...r,
        employe_nom: employes.get(String(r.employe_id ?? "")) ?? "—",
      }));
    },
    summary: (rows): SummaryRow[] => [
      { label: "Total salaire brut (FCFA)", value: formatFCFA(sum(rows, "salaire_brut")) },
      { label: "Total retenues (FCFA)", value: formatFCFA(sum(rows, "cotisations")) },
      { label: "Total net à payer (FCFA)", value: formatFCFA(sum(rows, "salaire_net")) },
    ],
  },
];
