import { supabase } from "@/integrations/supabase/client";
import type { ColisInfo, LivHistorique, LivStatut, LivSuiviCommande, LivTournee } from "./types";

type ColisListRow = {
  commande_id: string;
  date_colisage: string | null;
  livreur_nom: string | null;
  transporteur: string | null;
  vehicule: string | null;
  gare_depart: string | null;
  ville_destination: string | null;
  ville_livraison: string | null;
  destinataire: string | null;
  mode_acheminement: string | null;
  tournee: { statut: string | null } | null;
};

/**
 * Statuts de tournée qui autorisent l'affichage d'un suivi de livraison.
 * Une tournée doit avoir été validée (`en_cours`) ou terminée pour que ses
 * commandes apparaissent dans le module « Suivi de livraison ». Les tournées
 * en état `preparee` (brouillon) restent masquées.
 */
const TOURNEE_STATUTS_VISIBLES = ["en_cours", "terminee"] as const;

type TourneeJoin = {
  tournee_id: string;
  reference: string | null;
  statut: string | null;
  date_tournee: string | null;
  chauffeur_nom: string | null;
  vehicule: { immatriculation: string | null } | null;
};

function mapTournee(t: TourneeJoin | null | undefined): LivTournee | null {
  if (!t) return null;
  return {
    tournee_id: t.tournee_id,
    reference: t.reference,
    statut: t.statut,
    date_depart: t.date_tournee,
    livreur_nom: t.chauffeur_nom,
    vehicule: t.vehicule?.immatriculation ?? null,
  };
}

export async function listCommandesSuivi(opts?: {
  statut?: LivStatut;
  tourneeId?: string;
  q?: string;
}) {
  // Règle métier stricte (nouveau workflow) : une commande n'apparaît dans
  // le suivi que si elle est rattachée à une tournée validée. Les lignes
  // orphelines (tournee_id NULL) ou attachées à une tournée non validée
  // sont filtrées côté serveur (`tournee_id NOT NULL`) puis, pour le statut
  // exact de la tournée, côté client via `TOURNEE_STATUTS_VISIBLES`.
  let q = supabase
    .from("livsuivi_commandes")
    .select(
      "*, commande:commandes(reference, client_id, client_nom, ville, telephone, montant_total), tournee:tournees(tournee_id, reference, statut, date_tournee, chauffeur_nom, vehicule:vehicules(immatriculation))",
    )
    .not("tournee_id", "is", null)
    .order("derniere_maj", { ascending: false });
  if (opts?.statut) q = q.eq("statut", opts.statut);
  if (opts?.tourneeId) q = q.eq("tournee_id", opts.tourneeId);
  const { data, error } = await q;
  if (error) throw error;
  // Mapping local pour aplatir la jointure tournée + filtrage statut visible.
  let rows = ((data ?? []) as unknown as Array<
    LivSuiviCommande & { tournee?: TourneeJoin | null }
  >)
    .filter((r) =>
      r.tournee && r.tournee.statut
        ? (TOURNEE_STATUTS_VISIBLES as readonly string[]).includes(r.tournee.statut)
        : false,
    )
    .map((r) => ({ ...r, tournee: mapTournee(r.tournee) }) as LivSuiviCommande);

  // Round-trip complémentaire : infos de colisage (livreur, véhicule, gare,
  // ville…) affichées en repli dans la liste.
  const commandeIds = rows.map((r) => r.commande_id).filter(Boolean);
  if (commandeIds.length > 0) {
    const { data: colisRows, error: eColis } = await supabase
      .from("colis")
      .select(
        "commande_id, date_colisage, livreur_nom, transporteur, vehicule, gare_depart, ville_destination, ville_livraison, destinataire, mode_acheminement",
      )
      .in("commande_id", commandeIds)
      .order("date_colisage", { ascending: false });
    if (eColis) throw eColis;
    const list = (colisRows ?? []) as Omit<ColisListRow, "tournee">[];

    // Dernier colis par commande (list déjà trié desc)
    const latestByCmd = new Map<string, Omit<ColisListRow, "tournee">>();
    for (const c of list) if (!latestByCmd.has(c.commande_id)) latestByCmd.set(c.commande_id, c);
    rows = rows.map((r) => {
      const c = latestByCmd.get(r.commande_id);
      if (!c) return r;
      const colis: ColisInfo = {
        reference: null,
        numero_carton: null,
        nb_cartons: null,
        contenu: null,
        destinataire: c.destinataire,
        transporteur: c.transporteur,
        date_envoi: null,
        poids: null,
        bl_reference: null,
        bl_date_livraison: null,
        depot_nom: null,
        nb_colis: 0,
        livreur_nom: c.livreur_nom,
        livreur_telephone: null,
        vehicule: c.vehicule,
        gare_depart: c.gare_depart,
        gare_responsable: null,
        gare_telephone: null,
        ville_destination: c.ville_destination,
        ville_livraison: c.ville_livraison,
        quartier: null,
        commune: null,
        mode_acheminement: c.mode_acheminement,
      };
      return { ...r, colis } as LivSuiviCommande & { colis: ColisInfo };
    });
  }

  if (opts?.q) {
    const t = opts.q.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.commande?.reference?.toLowerCase().includes(t) ||
        r.commande?.client_nom?.toLowerCase().includes(t) ||
        r.commande?.ville?.toLowerCase().includes(t),
    );
  }
  return rows as Array<LivSuiviCommande & { colis?: ColisInfo | null }>;
}

export async function getSuiviByCommandeRef(ref: string) {
  // 1 seul round-trip : livsuivi + commande(+depot) + tournee (nouvelle table)
  const suiviRes = await supabase
    .from("livsuivi_commandes")
    .select(
      "*, commande:commandes!inner(commande_id, reference, client_id, client_nom, ville, telephone, adresse, montant_total, depot:depots(nom)), tournee:tournees(tournee_id, reference, statut, date_tournee, chauffeur_nom, vehicule:vehicules(immatriculation))",
    )
    .eq("commande.reference", ref)
    .limit(1)
    .maybeSingle();
  if (suiviRes.error) throw suiviRes.error;
  if (!suiviRes.data) return null;
  const raw = suiviRes.data as unknown as LivSuiviCommande & {
    commande: {
      commande_id: string;
      reference: string;
      client_id?: string | null;
      client_nom: string | null;
      ville: string | null;
      telephone: string | null;
      adresse: string | null;
      montant_total: number | null;
      depot: { nom: string | null } | null;
    };
    tournee?: TourneeJoin | null;
  };
  const data: LivSuiviCommande & {
    commande: (typeof raw)["commande"];
  } = { ...raw, tournee: mapTournee(raw.tournee) };
  const cmd = data.commande;
  const depotNom = cmd.depot?.nom ?? null;

  // 2e round-trip : colis (dernier) + count en une seule requête
  const colisRes = await supabase
    .from("colis")
    .select(
      "reference, numero_carton, nb_cartons, contenu, destinataire, transporteur, date_envoi, poids, bl_id, livreur_nom, livreur_telephone, vehicule, gare_depart, gare_responsable, gare_telephone, ville_destination, ville_livraison, quartier, commune, mode_acheminement, bl:bons_livraison(reference, date_livraison)",
      { count: "exact" },
    )
    .eq("commande_id", cmd.commande_id)
    .order("date_colisage", { ascending: false })
    .limit(1);
  const colisRow = (colisRes.data?.[0] ?? null) as
    | (Record<string, unknown> & {
        bl?: { reference: string | null; date_livraison: string | null } | null;
      })
    | null;
  const nbColis = colisRes.count ?? 0;
  const blRef = (colisRow?.bl?.reference as string | null) ?? null;
  const blDate = (colisRow?.bl?.date_livraison as string | null) ?? null;
  const colisInfo: ColisInfo | null = colisRow
    ? {
        reference: (colisRow.reference as string | null) ?? null,
        numero_carton: (colisRow.numero_carton as number | null) ?? null,
        nb_cartons: (colisRow.nb_cartons as number | null) ?? null,
        contenu: (colisRow.contenu as string | null) ?? null,
        destinataire: (colisRow.destinataire as string | null) ?? null,
        transporteur: (colisRow.transporteur as string | null) ?? null,
        date_envoi: (colisRow.date_envoi as string | null) ?? null,
        poids: (colisRow.poids as number | null) ?? null,
        bl_reference: blRef,
        bl_date_livraison: blDate,
        depot_nom: depotNom,
        // Règle métier : 1 commande = 1 colis. Chaque ligne de la table
        // `colis` = 1 carton physique. `nb_cartons` est renseigné plus haut
        // depuis la colonne `colis.nb_cartons` (ou repli sur `nbColis`).
        nb_colis: nbColis > 0 ? 1 : 0,
        livreur_nom: (colisRow.livreur_nom as string | null) ?? null,
        livreur_telephone: (colisRow.livreur_telephone as string | null) ?? null,
        vehicule: (colisRow.vehicule as string | null) ?? null,
        gare_depart: (colisRow.gare_depart as string | null) ?? null,
        gare_responsable: (colisRow.gare_responsable as string | null) ?? null,
        gare_telephone: (colisRow.gare_telephone as string | null) ?? null,
        ville_destination: (colisRow.ville_destination as string | null) ?? null,
        ville_livraison: (colisRow.ville_livraison as string | null) ?? null,
        quartier: (colisRow.quartier as string | null) ?? null,
        commune: (colisRow.commune as string | null) ?? null,
        mode_acheminement: (colisRow.mode_acheminement as string | null) ?? null,
      }
    : null;
  return {
    ...data,
    commande: cmd,
    colis: colisInfo,
  } as LivSuiviCommande & { colis: ColisInfo | null };
}

export async function getHistorique(livraisonId: string) {
  const { data, error } = await supabase
    .from("livsuivi_historique")
    .select("*")
    .eq("livraison_id", livraisonId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as LivHistorique[];
}

/**
 * Historique paginé (chargement progressif). Retourne la page + total pour
 * afficher un bouton "Charger plus".
 */
export async function getHistoriquePage(
  livraisonId: string,
  opts: { offset?: number; limit?: number } = {},
) {
  const offset = opts.offset ?? 0;
  const limit = opts.limit ?? 25;
  // Sans `count:exact` : la page ne recompte pas le total à chaque scroll.
  // Le total est fourni séparément par getHistoriqueCount().
  const { data, error } = await supabase
    .from("livsuivi_historique")
    .select("*")
    .eq("livraison_id", livraisonId)
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return {
    rows: (data ?? []) as unknown as LivHistorique[],
    nextOffset: (data ?? []).length === limit ? offset + limit : null,
  };
}

/** Recompte le total (une seule fois par livraison, invalidé au realtime). */
export async function getHistoriqueCount(livraisonId: string): Promise<number> {
  const { count, error } = await supabase
    .from("livsuivi_historique")
    .select("id", { head: true, count: "exact" })
    .eq("livraison_id", livraisonId);
  if (error) throw error;
  return count ?? 0;
}

// listTournees / getTournee supprimés : le module /tournees est désormais
// l'unique référentiel des tournées (table `tournees`). Consommer directement
// `supabase.from("tournees")` ou passer par `src/routes/_authenticated/tournees.*`.
