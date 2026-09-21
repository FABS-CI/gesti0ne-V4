-- Source de vérité unique pour l'encaissement : payment_allocations / payment_line_allocations

CREATE OR REPLACE FUNCTION public.rapport_kpi(_filtres jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_from date := NULLIF(_filtres->>'from','')::date;
  v_to   date := NULLIF(_filtres->>'to','')::date;
  v_qte numeric; v_ca_lignes numeric; v_nb_fact int; v_nb_clients int;
  v_facture numeric; v_encaisse numeric; v_nb_cmd int;
  v_top text; v_flop text;
BEGIN
  PERFORM public.assert_permission('rapports.voir_ca');

  SELECT COALESCE(SUM(l.quantite),0), COALESCE(SUM(l.ca),0),
         COUNT(DISTINCT l.facture_id), COUNT(DISTINCT l.client_id), COUNT(DISTINCT l.commande_id)
    INTO v_qte, v_ca_lignes, v_nb_fact, v_nb_clients, v_nb_cmd
    FROM public.rapport_lignes_filtrees(_filtres) l;

  SELECT COALESCE(SUM(t.montant_total),0) INTO v_facture FROM (
    SELECT DISTINCT fa.facture_id, fa.montant_total
    FROM public.factures fa
    WHERE fa.facture_id IN (SELECT l.facture_id FROM public.rapport_lignes_filtrees(_filtres) l)
  ) t;

  -- Encaissé = affectations réelles paiement -> facture (multi-factures supporté)
  SELECT COALESCE(SUM(pa.montant),0) INTO v_encaisse
    FROM public.payment_allocations pa
    JOIN public.paiements p ON p.paiement_id = pa.paiement_id
   WHERE COALESCE(p.statut,'') = 'valide'
     AND (v_from IS NULL OR p.date_paiement >= v_from)
     AND (v_to IS NULL OR p.date_paiement <= v_to)
     AND pa.facture_id IN (SELECT l.facture_id FROM public.rapport_lignes_filtrees(_filtres) l);

  SELECT p.titre INTO v_top FROM public.rapport_lignes_filtrees(_filtres) l
    JOIN public.produits p ON p.produit_id = l.produit_id
    GROUP BY p.titre ORDER BY SUM(l.ca) DESC LIMIT 1;
  SELECT p.titre INTO v_flop FROM public.rapport_lignes_filtrees(_filtres) l
    JOIN public.produits p ON p.produit_id = l.produit_id
    GROUP BY p.titre ORDER BY SUM(l.ca) ASC LIMIT 1;

  RETURN jsonb_build_object(
    'qte_vendue', v_qte, 'qte_facturee', v_qte,
    'nb_factures', v_nb_fact, 'nb_clients', v_nb_clients,
    'ca', v_ca_lignes,
    'montant_facture', v_facture,
    'montant_encaisse', v_encaisse,
    'reste_a_encaisser', GREATEST(0, v_facture - v_encaisse),
    'taux_encaissement', CASE WHEN v_facture > 0 THEN ROUND((v_encaisse / v_facture) * 100, 2) ELSE 0 END,
    'nb_commandes', v_nb_cmd,
    'prix_moyen', CASE WHEN v_qte > 0 THEN ROUND(v_ca_lignes / v_qte, 2) ELSE 0 END,
    'panier_moyen', CASE WHEN v_nb_fact > 0 THEN ROUND(v_facture / v_nb_fact, 2) ELSE 0 END,
    'top_produit', v_top, 'rentable_produit', v_top, 'flop_produit', v_flop
  );
END; $function$;

CREATE OR REPLACE FUNCTION public.rapport_produits(_filtres jsonb DEFAULT '{}'::jsonb, _tri text DEFAULT 'ca'::text, _sens text DEFAULT 'desc'::text, _limit integer DEFAULT 50, _offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_from date := NULLIF(_filtres->>'from','')::date;
  v_to   date := NULLIF(_filtres->>'to','')::date;
  v_total int; v_ca_total numeric; v_items jsonb;
BEGIN
  PERFORM public.assert_permission('rapports.voir_ca');

  WITH l AS (SELECT * FROM public.rapport_lignes_filtrees(_filtres)),
  ret AS (
    SELECT rl.produit_id, SUM(rl.quantite)::numeric AS qte
    FROM public.retour_lignes rl
    JOIN public.retours r ON r.retour_id = rl.retour_id
    WHERE COALESCE(r.statut,'') NOT IN ('annule','annulee','refuse','rejete')
      AND (v_from IS NULL OR r.date_retour >= v_from)
      AND (v_to IS NULL OR r.date_retour <= v_to)
    GROUP BY rl.produit_id
  ),
  enc AS (
    SELECT pla.produit_id, SUM(pla.montant)::numeric AS ca_encaisse
    FROM public.payment_line_allocations pla
    JOIN public.payment_allocations pa ON pa.allocation_id = pla.allocation_id
    JOIN public.paiements p ON p.paiement_id = pa.paiement_id
    WHERE COALESCE(p.statut,'') = 'valide'
      AND (v_from IS NULL OR p.date_paiement >= v_from)
      AND (v_to IS NULL OR p.date_paiement <= v_to)
      AND pa.facture_id IN (SELECT fl.facture_id FROM l fl)
    GROUP BY pla.produit_id
  ),
  agg AS (
    SELECT p.produit_id, p.reference AS code, p.titre, p.niveau, p.categorie,
           COALESCE(p.prix_vente,0)::numeric AS prix_unitaire,
           SUM(l.quantite)::numeric AS qte_vendue,
           COUNT(DISTINCT l.facture_id)::int AS nb_factures,
           COUNT(DISTINCT l.client_id)::int AS nb_clients,
           SUM(l.ca)::numeric AS ca,
           SUM(l.remise)::numeric AS remises,
           COALESCE(MAX(rt.qte),0)::numeric AS qte_retournee,
           COALESCE(MAX(e.ca_encaisse),0)::numeric AS ca_encaisse,
           COALESCE(p.stock,0)::numeric AS stock_actuel
    FROM l
    JOIN public.produits p ON p.produit_id = l.produit_id
    LEFT JOIN ret rt ON rt.produit_id = p.produit_id
    LEFT JOIN enc e ON e.produit_id = p.produit_id
    GROUP BY p.produit_id, p.reference, p.titre, p.niveau, p.categorie, p.prix_vente, p.stock
  ),
  tot AS (SELECT COALESCE(SUM(ca),0) AS ca_total, COUNT(*)::int AS n FROM agg),
  ranked AS (
    SELECT a.*, ROW_NUMBER() OVER (ORDER BY a.ca DESC)::int AS rang,
      CASE WHEN t.ca_total > 0 THEN ROUND(a.ca / t.ca_total * 100, 2) ELSE 0 END AS pct_ca
    FROM agg a CROSS JOIN tot t
  )
  SELECT (SELECT n FROM tot), (SELECT ca_total FROM tot),
    COALESCE(jsonb_agg(jsonb_build_object(
      'produit_id', produit_id, 'code', code, 'titre', titre,
      'niveau', niveau, 'categorie', categorie, 'prix_unitaire', prix_unitaire,
      'qte_vendue', qte_vendue, 'qte_facturee', qte_vendue,
      'nb_factures', nb_factures, 'nb_clients', nb_clients,
      'ca', ca, 'remises', remises, 'qte_retournee', qte_retournee,
      'ca_encaisse', ca_encaisse,
      'reste_a_encaisser', GREATEST(0, ca - ca_encaisse),
      'stock_actuel', stock_actuel,
      'stock_initial', stock_actuel + qte_vendue,
      'stock_restant', stock_actuel,
      'pct_ca', pct_ca, 'rang', rang
    ) ORDER BY
      CASE WHEN _tri='ca'      AND _sens='desc' THEN ca END DESC NULLS LAST,
      CASE WHEN _tri='ca'      AND _sens='asc'  THEN ca END ASC NULLS LAST,
      CASE WHEN _tri='encaisse' AND _sens='desc' THEN ca_encaisse END DESC NULLS LAST,
      CASE WHEN _tri='encaisse' AND _sens='asc'  THEN ca_encaisse END ASC NULLS LAST,
      CASE WHEN _tri='qte'     AND _sens='desc' THEN qte_vendue END DESC NULLS LAST,
      CASE WHEN _tri='qte'     AND _sens='asc'  THEN qte_vendue END ASC NULLS LAST,
      CASE WHEN _tri='stock'   AND _sens='desc' THEN stock_actuel END DESC NULLS LAST,
      CASE WHEN _tri='stock'   AND _sens='asc'  THEN stock_actuel END ASC NULLS LAST,
      titre
    ), '[]'::jsonb)
  INTO v_total, v_ca_total, v_items
  FROM ranked;

  RETURN jsonb_build_object('total', COALESCE(v_total,0), 'ca_total', COALESCE(v_ca_total,0),
    'items', COALESCE((SELECT jsonb_agg(elem) FROM (
        SELECT elem FROM jsonb_array_elements(COALESCE(v_items,'[]'::jsonb)) elem LIMIT _limit OFFSET _offset) s), '[]'::jsonb));
END; $function$;