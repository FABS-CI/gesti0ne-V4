CREATE OR REPLACE FUNCTION public._facture_diff_label(o jsonb, n jsonb, prix boolean)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  WITH lib(v, l) AS (VALUES ('impayee','Impayée'),('partielle','Partielle'),('payee','Payée'),('annulee','Annulée'),('avoir','Avoir')),
  f AS (SELECT
    CASE WHEN (o->>'statut') IS DISTINCT FROM (n->>'statut') AND o ? 'statut' AND n ? 'statut' THEN
      'Statut : ' || coalesce((SELECT l FROM lib WHERE v = o->>'statut'), o->>'statut', '—') || ' -> ' ||
      coalesce((SELECT l FROM lib WHERE v = n->>'statut'), n->>'statut', '—') END s,
    CASE WHEN (o->>'client_nom') IS DISTINCT FROM (n->>'client_nom') AND n ? 'client_nom' THEN
      'Client : ' || coalesce(o->>'client_nom','—') || ' -> ' || coalesce(n->>'client_nom','—') END c,
    CASE WHEN (o->>'date_facture') IS DISTINCT FROM (n->>'date_facture') AND n ? 'date_facture' THEN
      'Date de facture : ' || coalesce(to_char((o->>'date_facture')::date,'DD/MM/YYYY'),'—') || ' -> ' || coalesce(to_char((n->>'date_facture')::date,'DD/MM/YYYY'),'—') END df,
    CASE WHEN (o->>'date_echeance') IS DISTINCT FROM (n->>'date_echeance') AND n ? 'date_echeance' THEN
      'Échéance : ' || coalesce(to_char((o->>'date_echeance')::date,'DD/MM/YYYY'),'—') || ' -> ' || coalesce(to_char((n->>'date_echeance')::date,'DD/MM/YYYY'),'—') END de,
    CASE WHEN (o->>'reference') IS DISTINCT FROM (n->>'reference') AND n ? 'reference' THEN
      'Référence : ' || coalesce(o->>'reference','—') || ' -> ' || coalesce(n->>'reference','—') END r,
    CASE WHEN (o->>'montant_total')::numeric IS DISTINCT FROM (n->>'montant_total')::numeric AND n ? 'montant_total' THEN
      CASE WHEN prix THEN 'Total : ' || coalesce(regexp_replace(round((o->>'montant_total')::numeric)::bigint::text,'(\d)(?=(\d{3})+$)','\1 ','g') || ' FCFA','—')
        || ' -> ' || coalesce(regexp_replace(round((n->>'montant_total')::numeric)::bigint::text,'(\d)(?=(\d{3})+$)','\1 ','g') || ' FCFA','—')
      ELSE 'Total modifié' END END t,
    CASE WHEN (o->>'montant_frais_transport')::numeric IS DISTINCT FROM (n->>'montant_frais_transport')::numeric AND n ? 'montant_frais_transport' THEN
      CASE WHEN prix THEN 'Frais de transport : ' || coalesce(regexp_replace(round((o->>'montant_frais_transport')::numeric)::bigint::text,'(\d)(?=(\d{3})+$)','\1 ','g') || ' FCFA','—')
        || ' -> ' || coalesce(regexp_replace(round((n->>'montant_frais_transport')::numeric)::bigint::text,'(\d)(?=(\d{3})+$)','\1 ','g') || ' FCFA','—')
      ELSE 'Frais de transport modifiés' END END ft,
    CASE WHEN (o->>'type_frais_transport') IS DISTINCT FROM (n->>'type_frais_transport') AND n ? 'type_frais_transport' THEN
      'Mode de transport : ' || coalesce(o->>'type_frais_transport','—') || ' -> ' || coalesce(n->>'type_frais_transport','—') END mt)
  SELECT nullif(concat_ws(' · ', s, c, df, de, r, t, ft, mt), '') FROM f
$$;

CREATE OR REPLACE FUNCTION public.document_timeline(_type text, _id uuid)
 RETURNS TABLE(occurred_at timestamp with time zone, kind text, label text, actor_name text, ref text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_prix boolean;
  v_commande uuid;
BEGIN
  IF _type IS DISTINCT FROM 'facture' OR v_uid IS NULL THEN RETURN; END IF;
  IF NOT public.has_permission_v2(v_uid, 'factures.voir') THEN RETURN; END IF;
  v_prix := public.has_permission_v2(v_uid, 'factures.voir_prix');
  SELECT f.commande_id INTO v_commande FROM public.factures f WHERE f.facture_id = _id;

  RETURN QUERY
  WITH ev AS (
    SELECT a.created_at AS t,
      CASE a.action WHEN 'INSERT' THEN 'creation' WHEN 'DELETE' THEN 'suppression'
        ELSE CASE WHEN a.old_values->>'statut' IS NOT NULL AND a.new_values->>'statut' IS NOT NULL
                   AND a.old_values->>'statut' <> a.new_values->>'statut' THEN 'statut' ELSE 'modification' END END AS k,
      CASE a.action WHEN 'INSERT' THEN 'Facture créée' WHEN 'DELETE' THEN 'Facture supprimée'
        ELSE coalesce(public._facture_diff_label(a.old_values, a.new_values, v_prix), 'Facture modifiée') END AS l,
      a.user_id AS u, a.user_email AS e, coalesce(a.new_values, a.old_values)->>'reference' AS r
    FROM public.audit_logs a
    WHERE a.table_name = 'factures'
      AND a.action IN ('INSERT','UPDATE','DELETE')
      AND coalesce(a.new_values, a.old_values)->>'facture_id' = _id::text
    UNION ALL
    SELECT p.created_at, 'paiement',
      'Paiement ' || coalesce(p.reference, '') || ' enregistré'
        || CASE WHEN v_prix AND p.montant IS NOT NULL
             THEN ' : ' || regexp_replace(round(p.montant)::bigint::text, '(\d)(?=(\d{3})+$)', '\1 ', 'g') || ' FCFA' ELSE '' END,
      p.cree_par, NULL::text, p.reference
    FROM public.paiements p WHERE p.facture_id = _id
    UNION ALL
    SELECT pa.annule_le, 'annulation_paiement',
      'Paiement ' || coalesce(p.reference, '') || ' annulé', pa.annule_par, NULL::text, p.reference
    FROM public.paiement_annulations_audit pa
    LEFT JOIN public.paiements p ON p.paiement_id = pa.paiement_id
    WHERE pa.facture_id = _id
    UNION ALL
    SELECT h.created_at, 'envoi', 'Envoyée à ' || coalesce(h.destinataire, 'destinataire inconnu'),
      h.sent_by, NULL::text, h.reference
    FROM public.historique_envois h
    WHERE h.entity_id = _id AND h.entity_type IN ('facture','factures')
    UNION ALL
    SELECT coalesce(x.validated_at, x.submitted_at, x.created_at), 'fne',
      'DGI : ' || coalesce(x.statut, 'statut inconnu'), NULL::uuid, NULL::text, x.reference
    FROM public.fne_factures x WHERE x.facture_id = _id
    UNION ALL
    SELECT rt.created_at, 'retour', 'Retour ' || coalesce(rt.reference, '') || ' enregistré',
      rt.created_by, NULL::text, rt.reference
    FROM public.retours rt WHERE rt.facture_id = _id
    UNION ALL
    SELECT ch.created_at, 'livraison',
      'Colis ' || coalesce(c.reference, '') || ' : '
        || CASE WHEN ch.ancien_statut IS NOT NULL THEN ch.ancien_statut || ' -> ' ELSE '' END
        || coalesce(ch.nouveau_statut, ''),
      ch.user_id, ch.user_nom, c.reference
    FROM public.colis_statut_historique ch
    JOIN public.colis c ON c.colis_id = ch.colis_id
    WHERE v_commande IS NOT NULL AND c.commande_id = v_commande
    UNION ALL
    SELECT lh.created_at, 'livraison', 'Suivi livraison : ' || coalesce(lh.etape, ''),
      lh.user_id, lh.user_nom, NULL::text
    FROM public.livsuivi_historique lh
    JOIN public.livsuivi_commandes lc ON lc.id = lh.livraison_id
    WHERE v_commande IS NOT NULL AND lc.commande_id = v_commande
    UNION ALL
    SELECT n.created_at, 'note', n.body, n.author_id, n.author_name, NULL::text
    FROM public.document_notes n
    WHERE n.document_type = 'facture' AND n.document_id = _id
  )
  SELECT ev.t, ev.k, ev.l,
    coalesce(nullif(trim(pr.nom_complet), ''), pr.email, ev.e),
    ev.r
  FROM ev
  LEFT JOIN public.profiles pr ON pr.id = ev.u
  WHERE ev.t IS NOT NULL
  ORDER BY ev.t DESC
  LIMIT 100;
END;
$function$;