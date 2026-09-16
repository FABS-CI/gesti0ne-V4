-- Résumé d'audit comptable attendu par l'écran Audit Comptabilité & Finances (jsonb).
CREATE OR REPLACE FUNCTION public.audit_finances_resume()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ecr int; v_fac int; v_pai int;
  v_desq int; v_fac_inc int; v_sold int; v_orph int; v_doub int;
BEGIN
  PERFORM public.assert_permission('audit.voir');

  SELECT count(*) INTO v_ecr FROM public.ecritures_comptables;
  SELECT count(*) INTO v_fac FROM public.factures;
  SELECT count(*) INTO v_pai FROM public.paiements;

  SELECT count(*) INTO v_desq FROM (
    SELECT l.ecriture_id
    FROM public.ecriture_lignes l
    GROUP BY l.ecriture_id
    HAVING COALESCE(sum(l.debit),0) <> COALESCE(sum(l.credit),0)
  ) t;

  SELECT count(*) INTO v_fac_inc FROM public.factures f
  WHERE COALESCE(f.montant_paye,0) <> (
    SELECT COALESCE(sum(p.montant),0) FROM public.paiements p
    WHERE p.facture_id = f.facture_id AND p.statut = 'valide'
  );

  SELECT count(*) INTO v_sold FROM public.clients c
  WHERE COALESCE(c.solde,0) <> (
    SELECT COALESCE(sum(f.montant_total - COALESCE(f.montant_paye,0)),0)
    FROM public.factures f
    WHERE f.client_id = c.client_id AND f.statut IN ('impayee','partielle')
  );

  SELECT count(*) INTO v_orph FROM public.paiements p
  WHERE p.facture_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.factures f WHERE f.facture_id = p.facture_id);

  SELECT count(*) INTO v_doub FROM (
    SELECT p.facture_id, p.montant, p.date_paiement
    FROM public.paiements p
    WHERE p.statut = 'valide' AND p.facture_id IS NOT NULL
    GROUP BY p.facture_id, p.montant, p.date_paiement
    HAVING count(*) > 1
  ) d;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'total_ecritures', v_ecr,
    'total_factures', v_fac,
    'total_paiements', v_pai,
    'ecritures_desequilibrees', v_desq,
    'factures_incoherentes', v_fac_inc,
    'soldes_clients_incoherents', v_sold,
    'paiements_orphelins', v_orph,
    'doublons_paiement', v_doub,
    'verdict', CASE WHEN v_desq + v_fac_inc + v_sold + v_orph + v_doub = 0
                    THEN 'GO_PRODUCTION' ELSE 'ANOMALIES_DETECTEES' END
  );
END;
$$;

-- Détail des factures incohérentes, colonnes attendues par l'écran.
CREATE OR REPLACE FUNCTION public.audit_compta_factures_anomalies()
RETURNS TABLE(
  facture_id uuid,
  reference text,
  client_nom text,
  montant_total numeric,
  montant_paye_enregistre numeric,
  montant_paye_calcule numeric,
  ecart numeric,
  statut text,
  probleme text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_permission('audit.voir');
  RETURN QUERY
  SELECT f.facture_id,
         f.reference,
         COALESCE(f.client_nom, '—'),
         COALESCE(f.montant_total,0),
         COALESCE(f.montant_paye,0),
         calc.paye,
         COALESCE(f.montant_paye,0) - calc.paye,
         COALESCE(f.statut,'—'),
         CASE
           WHEN COALESCE(f.montant_paye,0) > calc.paye THEN 'Montant payé enregistré supérieur aux paiements validés'
           ELSE 'Montant payé enregistré inférieur aux paiements validés'
         END
  FROM public.factures f
  CROSS JOIN LATERAL (
    SELECT COALESCE(sum(p.montant),0) AS paye
    FROM public.paiements p
    WHERE p.facture_id = f.facture_id AND p.statut = 'valide'
  ) calc
  WHERE COALESCE(f.montant_paye,0) <> calc.paye
  ORDER BY abs(COALESCE(f.montant_paye,0) - calc.paye) DESC
  LIMIT 200;
END;
$$;

-- Écarts de soldes clients, colonnes attendues par l'écran.
CREATE OR REPLACE FUNCTION public.audit_compta_soldes_ecarts()
RETURNS TABLE(
  client_id uuid,
  reference text,
  nom text,
  solde_enregistre numeric,
  solde_calcule numeric,
  ecart numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_permission('audit.voir');
  RETURN QUERY
  SELECT c.client_id,
         COALESCE(c.reference,'—'),
         c.nom,
         COALESCE(c.solde,0),
         calc.solde,
         COALESCE(c.solde,0) - calc.solde
  FROM public.clients c
  CROSS JOIN LATERAL (
    SELECT COALESCE(sum(f.montant_total - COALESCE(f.montant_paye,0)),0) AS solde
    FROM public.factures f
    WHERE f.client_id = c.client_id AND f.statut IN ('impayee','partielle')
  ) calc
  WHERE COALESCE(c.solde,0) <> calc.solde
  ORDER BY abs(COALESCE(c.solde,0) - calc.solde) DESC
  LIMIT 200;
END;
$$;

-- Variantes avec motif, tracées, appelées par l'écran d'audit.
CREATE OR REPLACE FUNCTION public.recalculer_solde_client(_client_id uuid, _motif text)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_solde numeric;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'exercices.modifier') THEN
    RAISE EXCEPTION 'Permission refusée : exercices.modifier' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(sum(f.montant_total - COALESCE(f.montant_paye,0)),0) INTO v_solde
  FROM public.factures f
  WHERE f.client_id = _client_id AND f.statut IN ('impayee','partielle');
  UPDATE public.clients SET solde = v_solde WHERE client_id = _client_id;
  RETURN v_solde;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculer_soldes_global_clients(_motif text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_n int := 0;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'exercices.modifier') THEN
    RAISE EXCEPTION 'Permission refusée : exercices.modifier' USING ERRCODE = '42501';
  END IF;
  WITH upd AS (
    UPDATE public.clients c
       SET solde = (
         SELECT COALESCE(sum(f.montant_total - COALESCE(f.montant_paye,0)),0)
         FROM public.factures f
         WHERE f.client_id = c.client_id AND f.statut IN ('impayee','partielle')
       )
    RETURNING 1
  )
  SELECT count(*) INTO v_n FROM upd;
  RETURN jsonb_build_object('clients_traites', v_n, 'motif', _motif);
END;
$$;

GRANT EXECUTE ON FUNCTION public.audit_finances_resume() TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_compta_factures_anomalies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_compta_soldes_ecarts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculer_solde_client(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculer_soldes_global_clients(text) TO authenticated;