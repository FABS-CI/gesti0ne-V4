CREATE TRIGGER audit_crud_proformas AFTER INSERT OR DELETE OR UPDATE ON public.proformas FOR EACH ROW EXECUTE FUNCTION public.audit_crud_trigger();

CREATE INDEX IF NOT EXISTS idx_audit_logs_commande_id_expr ON public.audit_logs ((coalesce(new_values, old_values)->>'commande_id')) WHERE table_name = 'commandes';
CREATE INDEX IF NOT EXISTS idx_audit_logs_paiement_id_expr ON public.audit_logs ((coalesce(new_values, old_values)->>'paiement_id')) WHERE table_name = 'paiements';
CREATE INDEX IF NOT EXISTS idx_audit_logs_client_id_expr ON public.audit_logs ((coalesce(new_values, old_values)->>'client_id')) WHERE table_name = 'clients';
CREATE INDEX IF NOT EXISTS idx_audit_logs_proforma_id_expr ON public.audit_logs ((coalesce(new_values, old_values)->>'proforma_id')) WHERE table_name = 'proformas';
CREATE INDEX IF NOT EXISTS idx_audit_logs_retours_record ON public.audit_logs (record_id) WHERE table_name = 'retours';

CREATE OR REPLACE FUNCTION public._fmt_fcfa(v text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE WHEN v IS NULL OR v = '' THEN '—' ELSE regexp_replace(round(v::numeric)::bigint::text,'(\d)(?=(\d{3})+$)','\1 ','g') || ' FCFA' END
$$;

CREATE OR REPLACE FUNCTION public._statut_libelle(v text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE v
    WHEN 'impayee' THEN 'Impayée' WHEN 'partielle' THEN 'Partielle' WHEN 'payee' THEN 'Payée'
    WHEN 'annulee' THEN 'Annulée' WHEN 'avoir' THEN 'Avoir' WHEN 'validee' THEN 'Validée'
    WHEN 'en_attente' THEN 'En attente' WHEN 'brouillon' THEN 'Brouillon' WHEN 'rejetee' THEN 'Rejetée'
    WHEN 'valide' THEN 'Validé' WHEN 'rejete' THEN 'Rejeté' WHEN 'annule' THEN 'Annulé'
    WHEN 'emise' THEN 'Émise' WHEN 'convertie' THEN 'Convertie' WHEN 'expiree' THEN 'Expirée'
    WHEN 'actif' THEN 'Actif' WHEN 'inactif' THEN 'Inactif' WHEN 'bloque' THEN 'Bloqué'
    WHEN 'livree' THEN 'Livrée' WHEN 'facturee' THEN 'Facturée' WHEN 'cloture' THEN 'Clôturé'
    ELSE coalesce(initcap(replace(v,'_',' ')), '—') END
$$;

-- fields: tableau de [clé, libellé, genre] ; genre = text | date | money | statut
CREATE OR REPLACE FUNCTION public._doc_diff_label(o jsonb, n jsonb, fields jsonb, prix boolean)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE f jsonb; k text; lbl text; g text; a text; b text; parts text[] := '{}';
BEGIN
  IF o IS NULL OR n IS NULL THEN RETURN NULL; END IF;
  FOR f IN SELECT * FROM jsonb_array_elements(fields) LOOP
    k := f->>0; lbl := f->>1; g := f->>2;
    IF NOT (n ? k) THEN CONTINUE; END IF;
    a := o->>k; b := n->>k;
    IF g = 'money' THEN
      IF (a::numeric) IS NOT DISTINCT FROM (b::numeric) THEN CONTINUE; END IF;
      parts := parts || CASE WHEN prix THEN lbl || ' : ' || public._fmt_fcfa(a) || ' -> ' || public._fmt_fcfa(b) ELSE lbl || ' modifié' END;
    ELSE
      IF a IS NOT DISTINCT FROM b THEN CONTINUE; END IF;
      IF g = 'date' THEN
        a := to_char(a::date,'DD/MM/YYYY'); b := to_char(b::date,'DD/MM/YYYY');
      ELSIF g = 'statut' THEN
        a := public._statut_libelle(a); b := public._statut_libelle(b);
      END IF;
      parts := parts || (lbl || ' : ' || coalesce(nullif(a,''),'—') || ' -> ' || coalesce(nullif(b,''),'—'));
    END IF;
  END LOOP;
  RETURN nullif(array_to_string(parts, ' · '), '');
END $$;

CREATE OR REPLACE FUNCTION public.document_timeline(_type text, _id uuid)
 RETURNS TABLE(occurred_at timestamp with time zone, kind text, label text, actor_name text, ref text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_prix boolean;
  v_commande uuid;
  v_fields jsonb;
  v_table text;
  v_key text;
  v_nom text;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  IF _type = 'facture' THEN
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
      WHERE a.table_name = 'factures' AND a.action IN ('INSERT','UPDATE','DELETE')
        AND coalesce(a.new_values, a.old_values)->>'facture_id' = _id::text
      UNION ALL
      SELECT p.created_at, 'paiement',
        'Paiement ' || coalesce(p.reference, '') || ' enregistré'
          || CASE WHEN v_prix AND p.montant IS NOT NULL THEN ' : ' || public._fmt_fcfa(p.montant::text) ELSE '' END,
        p.cree_par, NULL::text, p.reference
      FROM public.paiements p WHERE p.facture_id = _id
      UNION ALL
      SELECT pa.annule_le, 'annulation_paiement', 'Paiement ' || coalesce(p.reference, '') || ' annulé', pa.annule_par, NULL::text, p.reference
      FROM public.paiement_annulations_audit pa LEFT JOIN public.paiements p ON p.paiement_id = pa.paiement_id
      WHERE pa.facture_id = _id
      UNION ALL
      SELECT h.created_at, 'envoi', 'Envoyée à ' || coalesce(h.destinataire, 'destinataire inconnu'), h.sent_by, NULL::text, h.reference
      FROM public.historique_envois h WHERE h.entity_id = _id AND h.entity_type IN ('facture','factures')
      UNION ALL
      SELECT coalesce(x.validated_at, x.submitted_at, x.created_at), 'fne', 'DGI : ' || coalesce(x.statut, 'statut inconnu'), NULL::uuid, NULL::text, x.reference
      FROM public.fne_factures x WHERE x.facture_id = _id
      UNION ALL
      SELECT rt.created_at, 'retour', 'Retour ' || coalesce(rt.reference, '') || ' enregistré', rt.created_by, NULL::text, rt.reference
      FROM public.retours rt WHERE rt.facture_id = _id
      UNION ALL
      SELECT ch.created_at, 'livraison',
        'Colis ' || coalesce(c.reference, '') || ' : ' || CASE WHEN ch.ancien_statut IS NOT NULL THEN ch.ancien_statut || ' -> ' ELSE '' END || coalesce(ch.nouveau_statut, ''),
        ch.user_id, ch.user_nom, c.reference
      FROM public.colis_statut_historique ch JOIN public.colis c ON c.colis_id = ch.colis_id
      WHERE v_commande IS NOT NULL AND c.commande_id = v_commande
      UNION ALL
      SELECT lh.created_at, 'livraison', 'Suivi livraison : ' || coalesce(lh.etape, ''), lh.user_id, lh.user_nom, NULL::text
      FROM public.livsuivi_historique lh JOIN public.livsuivi_commandes lc ON lc.id = lh.livraison_id
      WHERE v_commande IS NOT NULL AND lc.commande_id = v_commande
      UNION ALL
      SELECT n.created_at, 'note', n.body, n.author_id, n.author_name, NULL::text
      FROM public.document_notes n WHERE n.document_type = 'facture' AND n.document_id = _id
    )
    SELECT ev.t, ev.k, ev.l, coalesce(nullif(trim(pr.nom_complet), ''), pr.email, ev.e), ev.r
    FROM ev LEFT JOIN public.profiles pr ON pr.id = ev.u
    WHERE ev.t IS NOT NULL ORDER BY ev.t DESC LIMIT 100;
    RETURN;
  END IF;

  IF _type = 'retour' THEN
    IF NOT public.has_permission_v2(v_uid, 'retours.voir') THEN RETURN; END IF;
    RETURN QUERY
    WITH ev AS (
      SELECT a.created_at AS t, 'etape'::text AS k,
        CASE a.action
          WHEN 'retour.cree' THEN 'Retour créé'
          WHEN 'retour.receptionne' THEN 'Retour réceptionné au magasin'
          WHEN 'retour.traite_automatiquement' THEN 'Retour traité automatiquement'
            || CASE WHEN a.details ? 'valeur_retour' THEN ' : ' || public._fmt_fcfa(a.details->>'valeur_retour') ELSE '' END
          WHEN 'retour.valide_compta' THEN 'Retour validé en comptabilité'
            || CASE WHEN a.details ? 'avoir_reference' THEN ' (avoir ' || (a.details->>'avoir_reference') || ')' ELSE '' END
          WHEN 'retour.annule' THEN 'Retour annulé'
          ELSE 'Retour : ' || replace(replace(a.action, 'retour.', ''), '_', ' ') END AS l,
        a.user_id AS u, a.user_email AS e, NULL::text AS r
      FROM public.audit_logs a WHERE a.table_name = 'retours' AND a.record_id = _id::text
      UNION ALL
      SELECT rt.created_at, 'creation', 'Bon de retour enregistré', rt.created_by, rt.created_by_nom, rt.reference
      FROM public.retours rt WHERE rt.retour_id = _id
        AND NOT EXISTS (SELECT 1 FROM public.audit_logs a WHERE a.table_name='retours' AND a.record_id=_id::text AND a.action='retour.cree')
    )
    SELECT ev.t, ev.k, ev.l, coalesce(nullif(trim(pr.nom_complet), ''), pr.email, ev.e), ev.r
    FROM ev LEFT JOIN public.profiles pr ON pr.id = ev.u
    WHERE ev.t IS NOT NULL ORDER BY ev.t DESC LIMIT 100;
    RETURN;
  END IF;

  IF _type = 'commande' THEN
    IF NOT public.has_permission_v2(v_uid, 'commandes.voir') THEN RETURN; END IF;
    v_prix := public.has_permission_v2(v_uid, 'commandes.voir_prix');
    v_table := 'commandes'; v_key := 'commande_id'; v_nom := 'Commande';
    v_fields := '[["statut","Statut","statut"],["client_nom","Client","text"],["date_commande","Date","date"],["montant_total","Total","money"],["remise_globale_pct","Remise globale (%)","text"],["montant_frais_transport","Frais de transport","money"],["type_frais_transport","Mode de transport","text"]]';
  ELSIF _type = 'paiement' THEN
    IF NOT public.has_permission_v2(v_uid, 'paiements.voir') THEN RETURN; END IF;
    v_prix := true;
    v_table := 'paiements'; v_key := 'paiement_id'; v_nom := 'Paiement';
    v_fields := '[["statut","Statut","statut"],["montant","Montant","money"],["date_paiement","Date","date"],["mode_paiement","Mode","text"]]';
  ELSIF _type = 'client' THEN
    IF NOT public.has_permission_v2(v_uid, 'clients.voir') THEN RETURN; END IF;
    v_prix := public.has_permission_v2(v_uid, 'clients.voir_ca');
    v_table := 'clients'; v_key := 'client_id'; v_nom := 'Client';
    v_fields := '[["nom","Nom","text"],["reference","Code","text"],["type_client","Type","text"],["statut","Statut","statut"],["telephone","Téléphone","text"],["email","E-mail","text"],["ville","Ville","text"],["commune","Commune","text"],["adresse","Adresse","text"],["plafond_credit","Plafond de crédit","money"],["remise_habituelle","Remise habituelle","text"],["mode_paiement","Mode de paiement","text"]]';
  ELSIF _type = 'proforma' THEN
    IF NOT public.has_permission_v2(v_uid, 'proformas.voir') THEN RETURN; END IF;
    v_prix := true;
    v_table := 'proformas'; v_key := 'proforma_id'; v_nom := 'Proforma';
    v_fields := '[["statut","Statut","statut"],["client_nom","Client","text"],["date_proforma","Date","date"],["date_validite","Validité","date"],["montant_total","Total","money"]]';
  ELSE
    RETURN;
  END IF;

  RETURN QUERY
  WITH au AS (
    SELECT a.created_at AS t, a.action, a.old_values, a.new_values, a.user_id AS u, a.user_email AS e,
      coalesce(a.new_values, a.old_values)->>'reference' AS r,
      CASE WHEN a.action = 'UPDATE' THEN public._doc_diff_label(a.old_values, a.new_values, v_fields, v_prix) END AS d
    FROM public.audit_logs a
    WHERE a.table_name = v_table AND a.action IN ('INSERT','UPDATE','DELETE')
      AND coalesce(a.new_values, a.old_values)->>v_key = _id::text
  ),
  ev AS (
    SELECT au.t,
      CASE au.action WHEN 'INSERT' THEN 'creation' WHEN 'DELETE' THEN 'suppression'
        ELSE CASE WHEN (au.old_values->>'statut') IS DISTINCT FROM (au.new_values->>'statut') THEN 'statut' ELSE 'modification' END END AS k,
      CASE au.action WHEN 'INSERT' THEN v_nom || ' créé' || CASE WHEN v_nom IN ('Commande','Proforma') THEN 'e' ELSE '' END
        WHEN 'DELETE' THEN v_nom || ' supprimé' || CASE WHEN v_nom IN ('Commande','Proforma') THEN 'e' ELSE '' END
        ELSE au.d END AS l,
      au.u, au.e, au.r
    FROM au
    -- Les modifications sans changement visible (recalculs automatiques) sont ignorées
    WHERE au.action <> 'UPDATE' OR au.d IS NOT NULL
    -- Commande : colis, suivi, factures et proformas liées
    UNION ALL
    SELECT ch.created_at, 'livraison',
      'Colis ' || coalesce(c.reference, '') || ' : ' || CASE WHEN ch.ancien_statut IS NOT NULL THEN ch.ancien_statut || ' -> ' ELSE '' END || coalesce(ch.nouveau_statut, ''),
      ch.user_id, ch.user_nom, c.reference
    FROM public.colis_statut_historique ch JOIN public.colis c ON c.colis_id = ch.colis_id
    WHERE _type = 'commande' AND c.commande_id = _id
    UNION ALL
    SELECT lh.created_at, 'livraison', 'Suivi livraison : ' || coalesce(lh.etape, ''), lh.user_id, lh.user_nom, NULL::text
    FROM public.livsuivi_historique lh JOIN public.livsuivi_commandes lc ON lc.id = lh.livraison_id
    WHERE _type = 'commande' AND lc.commande_id = _id
    UNION ALL
    SELECT f.created_at, 'lien', 'Facture ' || coalesce(f.reference,'') || ' créée depuis cette commande', NULL::uuid, NULL::text, f.reference
    FROM public.factures f WHERE _type = 'commande' AND f.commande_id = _id
    UNION ALL
    SELECT pf.created_at, 'lien', 'Issue de la proforma ' || coalesce(pf.reference,''), NULL::uuid, NULL::text, pf.reference
    FROM public.proformas pf WHERE _type = 'commande' AND pf.commande_id = _id
    -- Proforma : commande issue
    UNION ALL
    SELECT c.created_at, 'lien', 'Commande ' || coalesce(c.reference,'') || ' issue de cette proforma', c.created_by, c.created_by_nom, c.reference
    FROM public.proformas pf JOIN public.commandes c ON c.commande_id = pf.commande_id
    WHERE _type = 'proforma' AND pf.proforma_id = _id
    -- Paiement : répartition et annulations
    UNION ALL
    SELECT pal.created_at, 'repartition', 'Affecté à la facture ' || coalesce(f.reference,'') || ' : ' || public._fmt_fcfa(pal.montant::text),
      pal.created_by, NULL::text, f.reference
    FROM public.payment_allocations pal LEFT JOIN public.factures f ON f.facture_id = pal.facture_id
    WHERE _type = 'paiement' AND pal.paiement_id = _id
    UNION ALL
    SELECT pa.annule_le, 'annulation_paiement', 'Paiement annulé', pa.annule_par, NULL::text, NULL::text
    FROM public.paiement_annulations_audit pa WHERE _type = 'paiement' AND pa.paiement_id = _id
    -- Client : renommages et interactions commerciales
    UNION ALL
    SELECT rj.created_at, 'renommage', 'Renommé : ' || coalesce(rj.ancien_nom,'—') || ' -> ' || coalesce(rj.nouveau_nom,'—'), NULL::uuid, NULL::text, NULL::text
    FROM public.client_renommage_journal rj WHERE _type = 'client' AND rj.client_id = _id
    UNION ALL
    SELECT coalesce(ci.date_interaction::timestamptz, ci.created_at), 'interaction',
      'Contact ' || coalesce(ci.canal, ci.type, '') || coalesce(' : ' || ci.sujet, ''), NULL::uuid, ci.agent_email, NULL::text
    FROM public.crm_interactions ci WHERE _type = 'client' AND ci.client_id = _id
  )
  SELECT ev.t, ev.k, ev.l, coalesce(nullif(trim(pr.nom_complet), ''), pr.email, ev.e), ev.r
  FROM ev LEFT JOIN public.profiles pr ON pr.id = ev.u
  WHERE ev.t IS NOT NULL ORDER BY ev.t DESC LIMIT 100;
END;
$function$;