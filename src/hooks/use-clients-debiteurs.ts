import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeSoldeClient } from "@/lib/pdf/etat-compte-solde";

export type ClientDebiteur = {
  client_id: string;
  reference: string;
  nom: string;
  telephone: string | null;
  representant: string | null;
  ville: string | null;
  solde: number;
  nbFacturesImpayees: number;
};

/**
 * Clients actifs avec une créance positive (solde > 0).
 * Réutilise la même source de vérité que l'état de compte clients
 * (computeSoldeClient : factures - allocations validées - retours + solde d'ouverture).
 */
export function useClientsDebiteurs() {
  return useQuery<ClientDebiteur[]>({
    queryKey: ["clients-debiteurs"],
    staleTime: 60_000,
    queryFn: async () => {
      const PAGE = 1000;
      type ClientRow = {
        client_id: string;
        reference: string;
        nom: string;
        telephone: string | null;
        representant: string | null;
        ville: string | null;
      };
      const clients: ClientRow[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("clients")
          .select("client_id, reference, nom, telephone, representant, ville")
          .eq("actif", true)
          .order("nom", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const page = (data ?? []) as ClientRow[];
        clients.push(...page);
        if (page.length < PAGE) break;
      }
      if (clients.length === 0) return [];

      type FactureRow = {
        facture_id: string;
        client_id: string | null;
        montant_total: number | null;
        date_facture: string;
      };
      type One<T> = T | T[] | null;
      type AllocRow = {
        montant: number;
        facture_id: string;
        factures: One<{ client_id: string | null }>;
        paiements: One<{ date_paiement: string; statut: string | null }>;
      };
      type AvoirRow = {
        client_id: string | null;
        montant: number;
        date_retour: string;
        statut: string | null;
      };
      type OuvertureRow = { client_id: string; montant: number };

      const [facturesRes, allocsRes, avoirsRes, ouverturesRes] = await Promise.all([
        supabase
          .from("factures")
          .select("facture_id, client_id, montant_total, date_facture")
          .not("client_id", "is", null),
        supabase
          .from("payment_allocations")
          .select("montant, facture_id, factures!inner(client_id), paiements!inner(date_paiement, statut)")
          .eq("paiements.statut", "valide"),
        supabase
          .from("retours")
          .select("client_id, montant, date_retour, statut")
          .not("client_id", "is", null)
          .neq("statut", "annule"),
        supabase.from("soldes_ouverture_clients").select("client_id, montant"),
      ]);
      if (facturesRes.error) throw facturesRes.error;
      if (allocsRes.error) throw allocsRes.error;
      if (avoirsRes.error) throw avoirsRes.error;
      if (ouverturesRes.error) throw ouverturesRes.error;

      const facturesData = (facturesRes.data ?? []) as FactureRow[];
      const allocsData = (allocsRes.data ?? []) as AllocRow[];
      const avoirsData = (avoirsRes.data ?? []) as AvoirRow[];
      const ouverturesData = (ouverturesRes.data ?? []) as OuvertureRow[];

      // Solde restant par facture (pour compter les factures impayées)
      const payeParFacture = new Map<string, number>();
      for (const a of allocsData) {
        payeParFacture.set(a.facture_id, (payeParFacture.get(a.facture_id) ?? 0) + Number(a.montant ?? 0));
      }
      const impayeesParClient = new Map<string, number>();
      for (const f of facturesData) {
        if (!f.client_id) continue;
        const reste = Number(f.montant_total ?? 0) - (payeParFacture.get(f.facture_id) ?? 0);
        if (reste > 0.01) {
          impayeesParClient.set(f.client_id, (impayeesParClient.get(f.client_id) ?? 0) + 1);
        }
      }

      const byClient = new Map<
        string,
        {
          factures: Array<{ facture_id: string; date_facture: string; montant_total: number | null }>;
          paiements: Array<{ date_paiement: string; montant: number | null; statut: string | null }>;
          avoirs: Array<{ date_retour: string; montant: number | null; statut: string | null }>;
          soldeOuvertureRow: number;
        }
      >();
      const bucket = (id: string) => {
        let b = byClient.get(id);
        if (!b) {
          b = { factures: [], paiements: [], avoirs: [], soldeOuvertureRow: 0 };
          byClient.set(id, b);
        }
        return b;
      };
      for (const o of ouverturesData) bucket(o.client_id).soldeOuvertureRow += Number(o.montant ?? 0);
      for (const f of facturesData) {
        if (!f.client_id) continue;
        bucket(f.client_id).factures.push({
          facture_id: f.facture_id,
          date_facture: f.date_facture,
          montant_total: Number(f.montant_total ?? 0),
        });
      }
      for (const a of allocsData) {
        const cid = Array.isArray(a.factures) ? a.factures[0]?.client_id : a.factures?.client_id;
        const pay = Array.isArray(a.paiements) ? a.paiements[0] : a.paiements;
        if (!cid || !pay) continue;
        bucket(cid).paiements.push({
          date_paiement: pay.date_paiement,
          montant: Number(a.montant ?? 0),
          statut: pay.statut ?? null,
        });
      }
      for (const r of avoirsData) {
        if (!r.client_id) continue;
        bucket(r.client_id).avoirs.push({
          date_retour: r.date_retour,
          montant: Number(r.montant ?? 0),
          statut: ["annule", "refus_magasin", "refus_compta"].includes((r.statut || "").toLowerCase())
            ? "annule"
            : "valide",
        });
      }

      const rows: ClientDebiteur[] = [];
      for (const c of clients) {
        const b = byClient.get(c.client_id);
        const solde = b
          ? computeSoldeClient({
              clientId: c.client_id,
              dateDebut: null,
              dateFin: null,
              soldeOuvertureRow: b.soldeOuvertureRow,
              factures: b.factures,
              paiements: b.paiements,
              avoirs: b.avoirs,
            }).solde
          : 0;
        if (solde <= 0.01) continue;
        rows.push({
          ...c,
          solde,
          nbFacturesImpayees: impayeesParClient.get(c.client_id) ?? 0,
        });
      }
      rows.sort((a, b) => Number(b.solde) - Number(a.solde));
      return rows;
    },
  });
}
