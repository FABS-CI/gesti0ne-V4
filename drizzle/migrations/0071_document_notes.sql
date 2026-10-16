CREATE TABLE public.document_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL CHECK (document_type IN ('facture')),
  document_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  author_id uuid NOT NULL,
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_document_notes_doc ON public.document_notes (document_type, document_id, created_at DESC);
REVOKE ALL ON public.document_notes FROM anon, authenticated;
GRANT ALL ON public.document_notes TO service_role;
ALTER TABLE public.document_notes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.prevent_document_note_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Notes internes inaltérables : % interdit', TG_OP USING ERRCODE = '42501';
END;
$$;
CREATE TRIGGER trg_document_notes_append_only
  BEFORE UPDATE OR DELETE ON public.document_notes
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_document_note_mutation();

INSERT INTO public.rbac3_actions (code, label, ordre) VALUES ('noter', 'Noter', 90)
  ON CONFLICT (code) DO NOTHING;
INSERT INTO public.rbac3_permissions (code, module_code, action_code, label, sensible)
  VALUES ('factures.noter', 'factures', 'noter', 'Notes internes — Factures', false)
  ON CONFLICT (code) DO NOTHING;
INSERT INTO public.rbac3_role_permissions (role_code, perm_code)
  SELECT DISTINCT rp.role_code, 'factures.noter' FROM public.rbac3_role_permissions rp
  WHERE rp.perm_code = 'factures.modifier'
  ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.ajouter_note_document(_type text, _id uuid, _body text)
RETURNS public.document_notes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_body text := btrim(coalesce(_body, ''));
  v_name text;
  v_row public.document_notes;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Non authentifié.' USING ERRCODE = '42501'; END IF;
  IF _type IS DISTINCT FROM 'facture' THEN RAISE EXCEPTION 'Type de document non pris en charge.'; END IF;
  IF NOT public.has_permission_v2(v_uid, 'factures.noter') OR NOT public.has_permission_v2(v_uid, 'factures.voir') THEN
    RAISE EXCEPTION 'Droit insuffisant pour ajouter une note.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.factures WHERE facture_id = _id) THEN
    RAISE EXCEPTION 'Facture introuvable.';
  END IF;
  IF char_length(v_body) = 0 THEN RAISE EXCEPTION 'La note est vide.'; END IF;
  IF char_length(v_body) > 2000 THEN RAISE EXCEPTION 'La note dépasse 2000 caractères.'; END IF;
  SELECT coalesce(nullif(btrim(nom_complet), ''), email) INTO v_name FROM public.profiles WHERE id = v_uid;
  IF v_name IS NULL THEN SELECT email INTO v_name FROM auth.users WHERE id = v_uid; END IF;
  INSERT INTO public.document_notes (document_type, document_id, body, author_id, author_name)
    VALUES ('facture', _id, v_body, v_uid, v_name) RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.ajouter_note_document(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ajouter_note_document(text, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.document_timeline(_type text, _id uuid)
 RETURNS TABLE(occurred_at timestamp with time zone, kind text, label text, actor_name text, ref text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
  WITH lib(v, l) AS (VALUES ('impayee','Impayée'),('partielle','Partielle'),('payee','Payée'),('annulee','Annulée'),('avoir','Avoir')),
  ev AS (
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
    -- Notes internes (texte libre non filtré par factures.voir_prix, choix validé)
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