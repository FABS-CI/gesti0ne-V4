CREATE OR REPLACE FUNCTION public.dashboard_widgets_all()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'clients_total', (SELECT count(*) FROM public.clients),
    'produits_total', (SELECT count(*) FROM public.produits),
    'factures_mois', (SELECT count(*) FROM public.factures WHERE created_at >= date_trunc('month', now())),
    'ca_mois', (SELECT COALESCE(sum(montant), 0) FROM public.paiements
                 WHERE statut = 'valide' AND date_paiement >= date_trunc('month', now())::date),
    'bl_en_cours', (SELECT count(*) FROM public.bons_livraison WHERE statut IS DISTINCT FROM 'livre'),
    'stock_faible', (SELECT count(*) FROM (
                      SELECT p.produit_id
                      FROM public.produits p
                      LEFT JOIN public.stocks_depots sd ON sd.produit_id = p.produit_id
                      WHERE p.actif IS DISTINCT FROM false
                      GROUP BY p.produit_id
                      HAVING COALESCE(sum(sd.quantite), 0) <= 5) s),
    'commandes_ouvertes', (SELECT count(*) FROM public.commandes WHERE statut IN ('brouillon','confirmee')),
    'paiements_recus_mois', (SELECT COALESCE(sum(montant), 0) FROM public.paiements
                 WHERE statut = 'valide' AND date_paiement >= date_trunc('month', now())::date)
  );
$function$;