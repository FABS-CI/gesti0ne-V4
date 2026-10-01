CREATE OR REPLACE FUNCTION public.cockpit_overview(_exercice_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := current_date;
  v_res jsonb := '{}'::jsonb;
  v_fac boolean; v_pai boolean; v_col boolean; v_ret boolean; v_stk boolean;
  v_liv boolean; v_cli boolean; v_dir boolean; v_ca boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié' USING ERRCODE = '28000';
  END IF;

  v_fac := public.has_permission_v2(v_uid, 'factures.voir');
  v_pai := public.has_permission_v2(v_uid, 'paiements.voir');
  v_col := public.has_permission_v2(v_uid, 'colisage.voir');
  v_ret := public.has_permission_v2(v_uid, 'retours.voir');
  v_stk := public.has_permission_v2(v_uid, 'stock.voir') OR public.has_permission_v2(v_uid, 'alertes_stock.voir');
  v_liv := public.has_permission_v2(v_uid, 'tournees.voir') OR public.has_permission_v2(v_uid, 'livraison_suivi.voir');
  v_cli := public.has_permission_v2(v_uid, 'clients.voir');
  v_dir := public.has_permission_v2(v_uid, 'dashboard_direction.voir') OR public.has_permission_v2(v_uid, 'dashboard_global.voir');
  v_ca  := public.has_permission_v2(v_uid, 'dashboard.voir_ca');

  v_res := jsonb_build_object('generatedAt', now(), 'today', v_today);

  -- Impayés (> 30 jours) + ancienneté
  IF v_fac THEN
    v_res := v_res || jsonb_build_object(
      'impayes30', (
        SELECT jsonb_build_object(
          'count', count(*),
          'montant', COALESCE(sum(f.montant_total - COALESCE(f.montant_paye,0)),0),
          'items', COALESCE((SELECT jsonb_agg(x) FROM (
              SELECT f2.facture_id AS id, f2.reference, f2.client_id, f2.client_nom,
                     f2.montant_total - COALESCE(f2.montant_paye,0) AS reste,
                     v_today - COALESCE(f2.date_echeance, f2.date_facture) AS jours
              FROM public.factures f2
              WHERE f2.statut IN ('impayee','partielle')
                AND f2.montant_total - COALESCE(f2.montant_paye,0) > 0
                AND v_today - COALESCE(f2.date_echeance, f2.date_facture) > 30
              ORDER BY jours DESC, reste DESC LIMIT 5) x), '[]'::jsonb))
        FROM public.factures f
        WHERE f.statut IN ('impayee','partielle')
          AND f.montant_total - COALESCE(f.montant_paye,0) > 0
          AND v_today - COALESCE(f.date_echeance, f.date_facture) > 30),
      'anciennete', (
        SELECT jsonb_build_object(
          'b0_30',  COALESCE(sum(r) FILTER (WHERE j <= 30),0),
          'b31_60', COALESCE(sum(r) FILTER (WHERE j BETWEEN 31 AND 60),0),
          'b61_90', COALESCE(sum(r) FILTER (WHERE j BETWEEN 61 AND 90),0),
          'b90p',   COALESCE(sum(r) FILTER (WHERE j > 90),0),
          'total',  COALESCE(sum(r),0))
        FROM (SELECT f.montant_total - COALESCE(f.montant_paye,0) AS r,
                     v_today - COALESCE(f.date_echeance, f.date_facture) AS j
              FROM public.factures f
              WHERE f.statut IN ('impayee','partielle')
                AND f.montant_total - COALESCE(f.montant_paye,0) > 0) a)
    );
  END IF;

  -- Clients débiteurs
  IF v_fac AND v_cli THEN
    v_res := v_res || jsonb_build_object('debiteurs', (
      SELECT jsonb_build_object(
        'count', count(*),
        'items', COALESCE((SELECT jsonb_agg(y) FROM (
            SELECT client_id, max(client_nom) AS client_nom, sum(montant_total - COALESCE(montant_paye,0)) AS reste
            FROM public.factures
            WHERE statut IN ('impayee','partielle') AND client_id IS NOT NULL
              AND montant_total - COALESCE(montant_paye,0) > 0
            GROUP BY client_id ORDER BY reste DESC LIMIT 5) y), '[]'::jsonb))
      FROM (SELECT client_id FROM public.factures
            WHERE statut IN ('impayee','partielle') AND client_id IS NOT NULL
              AND montant_total - COALESCE(montant_paye,0) > 0
            GROUP BY client_id) d));
  END IF;

  -- Commandes à préparer (BL à préparer)
  IF v_col THEN
    v_res := v_res || jsonb_build_object('aPreparer', (
      SELECT jsonb_build_object(
        'count', count(*),
        'items', COALESCE((SELECT jsonb_agg(z) FROM (
            SELECT b.bl_id AS id, b.reference, b.client_id, b.client_nom, b.date_bon
            FROM public.bons_livraison b WHERE b.statut = 'a_preparer'
            ORDER BY b.date_bon ASC NULLS LAST, b.created_at ASC LIMIT 5) z), '[]'::jsonb))
      FROM public.bons_livraison WHERE statut = 'a_preparer'));
  END IF;

  -- Livraisons en retard
  IF v_liv THEN
    v_res := v_res || jsonb_build_object('livraisonsRetard', (
      SELECT jsonb_build_object(
        'count', count(*),
        'items', COALESCE((SELECT jsonb_agg(w) FROM (
            SELECT l.livraison_id AS id, l.reference, l.client_nom, l.date_livraison, l.bl_id
            FROM public.livraisons l
            WHERE l.statut IN ('planifiee','en_cours') AND l.date_livraison::date < v_today
            ORDER BY l.date_livraison ASC LIMIT 5) w), '[]'::jsonb))
      FROM public.livraisons
      WHERE statut IN ('planifiee','en_cours') AND date_livraison::date < v_today));
  END IF;

  -- Paiements reçus aujourd'hui
  IF v_pai THEN
    v_res := v_res || jsonb_build_object('paiementsJour', (
      SELECT jsonb_build_object('count', count(*), 'montant', COALESCE(sum(montant),0))
      FROM public.paiements WHERE statut = 'valide' AND date_paiement = v_today));
  END IF;

  -- Produits sous seuil (stock réel des dépôts)
  IF v_stk THEN
    v_res := v_res || jsonb_build_object('stockBas', (
      WITH s AS (
        SELECT p.produit_id, p.titre, p.reference,
               COALESCE(sum(sd.quantite),0) AS stock,
               COALESCE(NULLIF(p.seuil_alerte,0), max(sd.seuil_alerte), 0) AS seuil
        FROM public.produits p
        LEFT JOIN public.stocks_depots sd ON sd.produit_id = p.produit_id
        WHERE p.actif
        GROUP BY p.produit_id
      )
      SELECT jsonb_build_object(
        'count', count(*) FILTER (WHERE seuil > 0 AND stock <= seuil),
        'items', COALESCE((SELECT jsonb_agg(t) FROM (
            SELECT produit_id AS id, titre, reference, stock, seuil FROM s
            WHERE seuil > 0 AND stock <= seuil ORDER BY (stock - seuil) ASC LIMIT 5) t), '[]'::jsonb))
      FROM s));
  END IF;

  -- Retours en attente
  IF v_ret THEN
    v_res := v_res || jsonb_build_object('retoursAttente', (
      SELECT jsonb_build_object(
        'count', count(*),
        'items', COALESCE((SELECT jsonb_agg(u) FROM (
            SELECT r.retour_id AS id, COALESCE(r.numero, r.reference) AS reference,
                   r.client_id, COALESCE(r.etablissement, r.client_nom) AS client_nom, r.date_retour
            FROM public.retours r
            WHERE r.statut NOT IN ('cloture','annule','annulee','refuse','rejete')
            ORDER BY r.date_retour ASC LIMIT 5) u), '[]'::jsonb))
      FROM public.retours WHERE statut NOT IN ('cloture','annule','annulee','refuse','rejete')));
  END IF;

  -- Direction (exercice consulté, 30 derniers jours)
  IF v_dir THEN
    v_res := v_res || jsonb_build_object('direction', jsonb_build_object(
      'commandes30', (SELECT count(*) FROM public.commandes
                      WHERE (_exercice_id IS NULL OR exercice_id = _exercice_id)
                        AND date_commande >= v_today - 30),
      'facture30', CASE WHEN v_ca THEN (SELECT COALESCE(sum(montant_total),0) FROM public.factures
                      WHERE (_exercice_id IS NULL OR exercice_id = _exercice_id)
                        AND COALESCE(statut,'') <> 'annulee' AND date_facture >= v_today - 30) END,
      'encaisse30', CASE WHEN v_ca THEN (SELECT COALESCE(sum(montant),0) FROM public.paiements
                      WHERE statut = 'valide' AND date_paiement >= v_today - 30) END,
      'resteTotal', CASE WHEN v_ca THEN (SELECT COALESCE(sum(montant_total - COALESCE(montant_paye,0)),0)
                      FROM public.factures WHERE statut IN ('impayee','partielle')) END,
      'topClients', CASE WHEN v_ca AND v_cli THEN COALESCE((SELECT jsonb_agg(c) FROM (
            SELECT client_id, max(client_nom) AS client_nom, sum(montant_total) AS montant
            FROM public.factures
            WHERE (_exercice_id IS NULL OR exercice_id = _exercice_id)
              AND COALESCE(statut,'') <> 'annulee' AND client_id IS NOT NULL
            GROUP BY client_id ORDER BY montant DESC LIMIT 5) c), '[]'::jsonb) END
    ));
  END IF;

  RETURN v_res;
END;
$function$;

REVOKE ALL ON FUNCTION public.cockpit_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cockpit_overview(uuid) TO authenticated;