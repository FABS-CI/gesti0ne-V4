-- Index partiel pour retrouver les événements d'audit d'une facture.
-- Réversible : DROP INDEX IF EXISTS public.idx_audit_logs_facture_id_expr;
-- (CREATE INDEX CONCURRENTLY impossible dans une migration transactionnelle ; table de petite taille.)
CREATE INDEX IF NOT EXISTS idx_audit_logs_facture_id_expr
  ON public.audit_logs ((coalesce(new_values, old_values)->>'facture_id'))
  WHERE table_name = 'factures';

-- RPC lecture seule. Réversible : DROP FUNCTION IF EXISTS public.document_timeline(text, uuid);
CREATE OR REPLACE FUNCTION public.document_timeline(_type text, _id uuid)
RETURNS TABLE(occurred_at timestamptz, kind text, label text, actor_name text, ref text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  WITH lib(v, l) AS (VALUES ('impayee','Impayée'),('partielle','Partielle'),('payee','Payée'),('annulee','Annulée'),('avoir','Avoir')),
  ev AS (
    -- Journal d'audit
    SELECT a.created_at AS t,
      CASE a.action WHEN 'INSERT' THEN 'creation' WHEN 'DELETE' THEN 'suppression'
        ELSE CASE WHEN a.old_values->>'statut' IS NOT NULL AND a.new_values->>'statut' IS NOT NULL
                   AND a.old_values->>'statut' <> a.new_values->>'statut' THEN 'statut' ELSE 'modification' END END AS k,
      CASE a.action WHEN 'INSERT' THEN 'Facture créée' WHEN 'DELETE' THEN 'Facture supprimée'
        ELSE CASE WHEN a.old_values->>'statut' IS NOT NULL AND a.new_values->>'statut' IS NOT NULL
                   AND a.old_values->>'statut' <> a.new_values->>'statut'
             THEN 'Statut : ' || coalesce((SELECT l FROM lib WHERE v = a.old_values->>'statut'), a.old_values->>'statut')
                  || ' -> ' || coalesce((SELECT l FROM lib WHERE v = a.new_values->>'statut'), a.new_values->>'statut')
             ELSE 'Facture modifiée' END END AS l,
      a.user_id AS u, a.user_email AS e, coalesce(a.new_values, a.old_values)->>'reference' AS r
    FROM public.audit_logs a
    WHERE a.table_name = 'factures'
      AND a.action IN ('INSERT','UPDATE','DELETE')
      AND coalesce(a.new_values, a.old_values)->>'facture_id' = _id::text
    UNION ALL
    -- Paiements
    SELECT p.created_at, 'paiement',
      'Paiement ' || coalesce(p.reference, '') || ' enregistré'
        || CASE WHEN v_prix AND p.montant IS NOT NULL
             THEN ' : ' || regexp_replace(round(p.montant)::bigint::text, '(\d)(?=(\d{3})+$)', '\1 ', 'g') || ' FCFA' ELSE '' END,
      p.cree_par, NULL::text, p.reference
    FROM public.paiements p WHERE p.facture_id = _id
    UNION ALL
    -- Annulations de paiement
    SELECT pa.annule_le, 'annulation_paiement',
      'Paiement ' || coalesce(p.reference, '') || ' annulé', pa.annule_par, NULL::text, p.reference
    FROM public.paiement_annulations_audit pa
    LEFT JOIN public.paiements p ON p.paiement_id = pa.paiement_id
    WHERE pa.facture_id = _id
    UNION ALL
    -- Envois
    SELECT h.created_at, 'envoi', 'Envoyée à ' || coalesce(h.destinataire, 'destinataire inconnu'),
      h.sent_by, NULL::text, h.reference
    FROM public.historique_envois h
    WHERE h.entity_id = _id AND h.entity_type IN ('facture','factures')
    UNION ALL
    -- DGI / FNE : statut uniquement
    SELECT coalesce(x.validated_at, x.submitted_at, x.created_at), 'fne',
      'DGI : ' || coalesce(x.statut, 'statut inconnu'), NULL::uuid, NULL::text, x.reference
    FROM public.fne_factures x WHERE x.facture_id = _id
    UNION ALL
    -- Retours
    SELECT rt.created_at, 'retour', 'Retour ' || coalesce(rt.reference, '') || ' enregistré',
      rt.created_by, NULL::text, rt.reference
    FROM public.retours rt WHERE rt.facture_id = _id
    UNION ALL
    -- Livraison : colis de la commande liée
    SELECT ch.created_at, 'livraison',
      'Colis ' || coalesce(c.reference, '') || ' : '
        || CASE WHEN ch.ancien_statut IS NOT NULL THEN ch.ancien_statut || ' -> ' ELSE '' END
        || coalesce(ch.nouveau_statut, ''),
      ch.user_id, ch.user_nom, c.reference
    FROM public.colis_statut_historique ch
    JOIN public.colis c ON c.colis_id = ch.colis_id
    WHERE v_commande IS NOT NULL AND c.commande_id = v_commande
    UNION ALL
    -- Livraison : suivi
    SELECT lh.created_at, 'livraison', 'Suivi livraison : ' || coalesce(lh.etape, ''),
      lh.user_id, lh.user_nom, NULL::text
    FROM public.livsuivi_historique lh
    JOIN public.livsuivi_commandes lc ON lc.id = lh.livraison_id
    WHERE v_commande IS NOT NULL AND lc.commande_id = v_commande
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
$$;

REVOKE ALL ON FUNCTION public.document_timeline(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.document_timeline(text, uuid) TO authenticated;