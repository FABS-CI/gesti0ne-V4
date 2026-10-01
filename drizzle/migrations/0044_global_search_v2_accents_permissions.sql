CREATE OR REPLACE FUNCTION public.search_fold(_t text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public AS $$
  SELECT lower(translate(coalesce(_t,''),
    'àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝ',
    'aaaaaaceeeeiiiinooooouuuuyyaaaaaaceeeeiiiinooooouuuuy'))
$$;

CREATE OR REPLACE FUNCTION public.global_search(_q text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_q text;
  v_like text;
  v_q_norm text;
  v_results jsonb;
BEGIN
  IF v_uid IS NULL OR _q IS NULL OR length(trim(_q)) < 2 THEN
    RETURN '[]'::jsonb;
  END IF;
  v_q := public.search_fold(trim(_q));
  v_like := '%' || replace(replace(replace(v_q,'\','\\'),'%','\%'),'_','\_') || '%';
  v_q_norm := public.normalize_phone(_q);

  WITH hits AS (
    (SELECT client_id::text id, 'Clients' "group", nom label,
            concat_ws(' · ', ville, representant, telephone) sub,
            '/clients/$clientId' "to", jsonb_build_object('clientId', client_id) params, 1 priority
       FROM public.clients
      WHERE public.has_permission_v2(v_uid, 'clients.voir')
        AND (public.search_fold(nom) LIKE v_like OR public.search_fold(reference) LIKE v_like
             OR public.search_fold(ville) LIKE v_like
             OR (v_q_norm <> '' AND phone_normalized LIKE '%'||v_q_norm||'%'))
      LIMIT 8)
    UNION ALL
    (SELECT commande_id::text, 'Commandes', reference, client_nom,
            '/commandes/$commandeId', jsonb_build_object('commandeId', commande_id), 2
       FROM public.commandes
      WHERE public.has_permission_v2(v_uid, 'commandes.voir')
        AND (public.search_fold(reference) LIKE v_like OR public.search_fold(client_nom) LIKE v_like)
      ORDER BY created_at DESC LIMIT 6)
    UNION ALL
    (SELECT facture_id::text, 'Factures', reference, client_nom,
            '/factures/$factureId', jsonb_build_object('factureId', facture_id), 3
       FROM public.factures
      WHERE public.has_permission_v2(v_uid, 'factures.voir')
        AND (public.search_fold(reference) LIKE v_like OR public.search_fold(client_nom) LIKE v_like)
      ORDER BY created_at DESC LIMIT 6)
    UNION ALL
    (SELECT bl_id::text, 'Bons de livraison', reference, client_nom,
            '/colisage/$blId', jsonb_build_object('blId', bl_id), 4
       FROM public.bons_livraison
      WHERE public.has_permission_v2(v_uid, 'colisage.voir')
        AND (public.search_fold(reference) LIKE v_like OR public.search_fold(client_nom) LIKE v_like)
      ORDER BY created_at DESC LIMIT 5)
    UNION ALL
    (SELECT paiement_id::text, 'Paiements', reference,
            concat_ws(' · ', client_nom, montant::text || ' FCFA', statut),
            '/paiements/$paiementId', jsonb_build_object('paiementId', paiement_id), 5
       FROM public.paiements
      WHERE public.has_permission_v2(v_uid, 'paiements.voir')
        AND (public.search_fold(reference) LIKE v_like OR public.search_fold(client_nom) LIKE v_like
             OR public.search_fold(num_transaction) LIKE v_like)
      ORDER BY created_at DESC LIMIT 5)
    UNION ALL
    (SELECT proforma_id::text, 'Proformas', reference, client_nom,
            '/proformas/$proformaId', jsonb_build_object('proformaId', proforma_id), 6
       FROM public.proformas
      WHERE public.has_permission_v2(v_uid, 'proformas.voir')
        AND (public.search_fold(reference) LIKE v_like OR public.search_fold(client_nom) LIKE v_like)
      LIMIT 5)
    UNION ALL
    (SELECT produit_id::text, 'Produits', titre, reference,
            '/produits/$produitId', jsonb_build_object('produitId', produit_id), 7
       FROM public.produits
      WHERE public.has_permission_v2(v_uid, 'produits.voir')
        AND (public.search_fold(titre) LIKE v_like OR public.search_fold(reference) LIKE v_like)
      LIMIT 6)
    UNION ALL
    (SELECT id::text, 'Utilisateurs', nom_complet, telephone, '/utilisateurs', '{}'::jsonb, 8
       FROM public.profiles
      WHERE public.has_permission_v2(v_uid, 'utilisateurs.voir')
        AND (public.search_fold(nom_complet) LIKE v_like
             OR (v_q_norm <> '' AND phone_normalized LIKE '%'||v_q_norm||'%'))
      LIMIT 5)
  )
  SELECT jsonb_agg(h ORDER BY priority) INTO v_results
    FROM (SELECT id, "group", label, sub, "to", params, priority FROM hits) h;
  RETURN COALESCE(v_results, '[]'::jsonb);
END; $function$;

REVOKE ALL ON FUNCTION public.global_search(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.global_search(text) TO authenticated;