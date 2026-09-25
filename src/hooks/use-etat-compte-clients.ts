import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeSoldeClient, type SoldeDebug } from "@/lib/pdf/etat-compte-solde";

export type EtatCompteClient = {
  client_id: string;
  reference: string;
  nom: string;
  telephone: string | null;
  representant: string | null;
  plafond_credit: number;
  solde: number;
};

export type EtatCompteData = {
  rows: EtatCompteClient[];
  debugByClient: Map<string, SoldeDebug>;
  dateDebut: string | null;
  dateFin: string | null;
};

export function useEtatCompteClients(q: string, exerciceId: string | null | undefined) {
  return useQuery<EtatCompteData>({
    queryKey: ["etat-compte", q, exerciceId],
    staleTime: 60_000,
    queryFn: async () => {
      // 1) Charger tous les clients (une seule requête paginée large).
      const PAGE = 1000;
      const base: Omit<EtatCompteClient, "solde">[] = [];
      for (let from = 0; ; from += PAGE) {
        let query = supabase
          .from("clients")
          .select("client_id, reference, nom, telephone, representant, plafond_credit");
        if (q) query = query.or(`nom.ilike.%${q}%,reference.ilike.%${q}%`);
        const { data, error } = await query
          .order("nom", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const page = (data ?? []) as Omit<EtatCompteClient, "solde">[];
        base.push(...page);
        if (page.length < PAGE) break;
      }
      if (base.length === 0)
        return { rows: [], debugByClient: new Map(), dateDebut: null, dateFin: null };

      const dateDebut: string | null = null;
      const dateFin: string | null = null;

      type FactureRow = {
        facture_id: string;
        client_id: string | null;
        montant_total: number | null;
        date_facture: string;
      };
      type One<T> = T | T[] | null;
      type PaiementRow = {
        montant: number;
        factures: One<{ client_id: string | null }>;
        paiements: One<{ date_paiement: string; statut: string | null }>;
      };
      type AvoirRow = {
        client_id: string | null;
        facture_id: string | null;
        montant: number;
        date_retour: string;
        statut: string | null;
      };
      type OuvertureRow = { client_id: string; montant: number };

      // 2) Charger les mouvements en une seule requête chacun
      //    (pas de batch par 100 clients : c'était la cause des 30+ requêtes lentes).
      const [facturesRes, paiementsRes, avoirsRes, ouverturesRes] = await Promise.all([
        supabase
          .from("factures")
          .select("facture_id, client_id, montant_total, date_facture")
          .not("client_id", "is", null),
        supabase
          .from("payment_allocations")
          .select("montant, factures!inner(client_id), paiements!inner(date_paiement, statut)")
          .eq("paiements.statut", "valide"),
        supabase
          .from("retours")
          .select("client_id, facture_id, montant, date_retour, statut")
          .not("client_id", "is", null)
          .neq("statut", "annule"), // Performance : exclure les retours annulés
        exerciceId
          ? supabase
              .from("soldes_ouverture_clients")
              .select("client_id, montant")
              .eq("exercice_id", exerciceId)
          : Promise.resolve({ data: [] as OuvertureRow[], error: null }),
      ]);
      if (facturesRes.error) throw facturesRes.error;
      if (paiementsRes.error) throw paiementsRes.error;
      if (avoirsRes.error) throw avoirsRes.error;
      if ("error" in ouverturesRes && ouverturesRes.error) throw ouverturesRes.error;

      const facturesData = (facturesRes.data ?? []) as FactureRow[];
      const paiementsData = (paiementsRes.data ?? []) as PaiementRow[];
      const avoirsData = (avoirsRes.data ?? []) as AvoirRow[];
      const ouverturesData = (ouverturesRes.data ?? []) as OuvertureRow[];

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
      for (const o of ouverturesData) bucket(o.client_id).soldeOuvertureRow = Number(o.montant ?? 0);
      for (const f of facturesData) {
        if (!f.client_id) continue;
        bucket(f.client_id).factures.push({
          facture_id: f.facture_id,
          date_facture: f.date_facture as string,
          montant_total: Number(f.montant_total ?? 0),
        });
      }
      for (const p of paiementsData) {
        const cid = Array.isArray(p.factures) ? p.factures[0]?.client_id : p.factures?.client_id;
        const pay = Array.isArray(p.paiements) ? p.paiements[0] : p.paiements;
        if (!cid || !pay) continue;
        bucket(cid).paiements.push({
          date_paiement: pay.date_paiement,
          montant: Number(p.montant ?? 0),
          statut: pay.statut ?? null,
        });
      }
      for (const a of avoirsData) {
        if (!a.client_id) continue;
        bucket(a.client_id).avoirs.push({
          date_retour: a.date_retour,
          montant: Number(a.montant ?? 0),
          statut: ["annule", "refus_magasin", "refus_compta"].includes((a.statut || "").toLowerCase()) ? "annule" : "valide",
        });
      }

      const debugByClient = new Map<string, SoldeDebug>();
      const rows: EtatCompteClient[] = base.map((c) => {
        const b = byClient.get(c.client_id);
        if (!b) {
          // Client sans mouvement → solde 0, on évite computeSoldeClient.
          return { ...c, solde: 0 };
        }
        const r = computeSoldeClient({
          clientId: c.client_id,
          dateDebut,
          dateFin,
          soldeOuvertureRow: b.soldeOuvertureRow,
          factures: b.factures,
          paiements: b.paiements,
          avoirs: b.avoirs,
        });
        debugByClient.set(c.client_id, r.debug);
        return { ...c, solde: r.solde };
      });
      rows.sort((a, b) => Number(b.solde) - Number(a.solde));
      return { rows, debugByClient, dateDebut, dateFin };
    },
  });
}
