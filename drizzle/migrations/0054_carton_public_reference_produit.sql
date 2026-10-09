CREATE OR REPLACE FUNCTION public.get_carton_public(_colis_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'colis_id', c.colis_id,
    'reference_colis', c.reference,
    'numero_carton', c.numero_carton,
    'nb_cartons', c.nb_cartons,
    'bl_reference', bl.reference,
    'bl_statut', bl.statut,
    'commande_reference', cmd.reference,
    'client_nom', COALESCE(cmd.client_nom, bl.client_nom),
    'etablissement', cmd.etablissement,
    'destinataire', c.destinataire,
    'telephone', cmd.telephone,
    'adresse', cmd.adresse,
    'ville', cmd.ville,
    'destination', COALESCE(c.ville_livraison, c.ville_destination),
    'mode_acheminement', c.mode_acheminement,
    'statut_logistique', c.statut,
    'date_colisage', c.date_colisage,
    'preparateur', c.responsable_nom,
    'observations', c.observations,
    'produits', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('reference', cl.reference_produit, 'designation', cl.designation, 'quantite', cl.quantite) ORDER BY cl.created_at)
      FROM public.colis_lignes cl WHERE cl.colis_id = c.colis_id
    ), '[]'::jsonb)
  )
  FROM public.colis c
  LEFT JOIN public.bons_livraison bl ON bl.bl_id = c.bl_id
  LEFT JOIN public.commandes cmd ON cmd.commande_id = bl.commande_id
  WHERE c.colis_id = _colis_id;
$function$;