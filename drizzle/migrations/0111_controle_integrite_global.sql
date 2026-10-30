-- Contrôle d'intégrité entre modules (audit de l'interconnexion Finances / Comptabilité / RH).
--
-- Chaque pièce de gestion qui doit être comptabilisée l'est par un générateur
-- idempotent (pièce FACT:, PAI:, ACH:, BUL:, RET:). Ce contrôle, en lecture seule,
-- rapproche les deux côtés : rien n'est généré ni corrigé automatiquement (les
-- corrections passent par contre-passation ou annulation, avec trace).
--
-- Anomalies signalées :
--   - pièce validée sans écriture active ;
--   - écriture active dont le total ne correspond plus à la pièce ;
--   - pièce comptabilisée plusieurs fois ;
--   - écriture active d'une pièce supprimée ou qui ne doit plus être comptabilisée ;
--   - écriture déséquilibrée ou vide ;
--   - bulletins de paie (écarts, chevauchements : paie_controle_ecarts) ;
--   - transactions Finances « salaire » validées, à rapprocher des bulletins (risque de
--     double comptage dans les tableaux de gestion).

CREATE OR REPLACE FUNCTION public.controle_integrite_global()
RETURNS TABLE(domaine text, anomalie text, piece text, reference text,
              montant_piece numeric, montant_ecritures numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_permission(auth.uid(), 'comptabilite.voir') THEN
    RAISE EXCEPTION 'Permission refusée : comptabilite.voir' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH ecr AS (
    -- Écritures actives des pièces générées, total au débit des lignes.
    SELECT split_part(e.piece_ref, ':', 1) AS type_piece,
           split_part(e.piece_ref, ':', 2)::uuid AS piece_id,
           count(*) AS nb,
           sum((SELECT coalesce(sum(l.debit), 0) FROM public.ecriture_lignes l
                 WHERE l.ecriture_id = e.ecriture_id)) AS total
      FROM public.ecritures_comptables e
     WHERE e.piece_ref ~ '^(FACT|PAI|ACH|BUL|RET):[0-9a-f-]{36}$'
       AND e.contrepassee_le IS NULL AND e.contrepassation_de IS NULL
     GROUP BY 1, 2
  ), src AS (
    SELECT 'FACT'::text AS type_piece, f.facture_id AS piece_id, f.reference, f.montant_total AS montant,
           (f.statut IS DISTINCT FROM 'annulee' AND coalesce(f.montant_total, 0) <> 0) AS doit
      FROM public.factures f
    UNION ALL
    SELECT 'PAI', p.paiement_id, p.reference, p.montant,
           (p.statut = 'valide' AND coalesce(p.montant, 0) <> 0)
      FROM public.paiements p
    UNION ALL
    SELECT 'ACH', a.achat_id, a.reference, a.montant,
           (a.statut IN ('confirme', 'receptionne', 'paye') AND coalesce(a.montant, 0) <> 0)
      FROM public.achats a
  ), j AS (
    SELECT coalesce(s.type_piece, ecr.type_piece) AS type_piece,
           coalesce(s.piece_id, ecr.piece_id) AS piece_id,
           s.reference, s.montant, coalesce(s.doit, false) AS doit, s.piece_id IS NULL AS absente,
           ecr.nb, ecr.total
      FROM src s
      FULL JOIN (SELECT * FROM ecr WHERE ecr.type_piece IN ('FACT', 'PAI', 'ACH')) ecr
        ON ecr.type_piece = s.type_piece AND ecr.piece_id = s.piece_id
  )
  SELECT CASE j.type_piece WHEN 'ACH' THEN 'Achats' ELSE 'Ventes et encaissements' END,
         CASE
           WHEN j.absente THEN 'Écriture active d''une pièce supprimée'
           WHEN j.doit AND j.nb IS NULL THEN 'Pièce validée sans écriture'
           WHEN NOT j.doit AND j.nb IS NOT NULL THEN 'Écriture active d''une pièce annulée ou non validée'
           WHEN j.nb > 1 THEN 'Pièce comptabilisée plusieurs fois'
           ELSE 'Écriture ≠ pièce'
         END,
         j.type_piece || ':' || j.piece_id::text, j.reference, j.montant, j.total
    FROM j
   WHERE j.absente
      OR (j.doit AND j.nb IS NULL)
      OR (NOT j.doit AND j.nb IS NOT NULL)
      OR (j.doit AND (j.nb > 1 OR round(j.total) <> round(j.montant)))

  UNION ALL
  SELECT 'Comptabilité',
         CASE WHEN d.nb_lignes = 0 THEN 'Écriture sans lignes' ELSE 'Écriture déséquilibrée' END,
         coalesce(d.piece_ref, d.ecriture_id::text), d.reference, d.total_debit, d.total_credit
    FROM (
      SELECT e.ecriture_id, e.piece_ref, e.reference,
             count(l.ecriture_id) AS nb_lignes,
             coalesce(sum(l.debit), 0) AS total_debit, coalesce(sum(l.credit), 0) AS total_credit
        FROM public.ecritures_comptables e
        LEFT JOIN public.ecriture_lignes l ON l.ecriture_id = e.ecriture_id
       GROUP BY e.ecriture_id, e.piece_ref, e.reference
    ) d
   WHERE d.nb_lignes = 0 OR round(d.total_debit, 2) <> round(d.total_credit, 2)

  UNION ALL
  SELECT 'Paie', c.anomalie, 'BUL:' || c.bulletin_id::text, c.reference,
         c.montant_bulletin, c.montant_ecritures
    FROM public.paie_controle_ecarts() c

  UNION ALL
  SELECT 'Finances', 'Transaction « salaire » à rapprocher des bulletins (double comptage possible)',
         'TRX:' || t.transaction_id::text, t.reference, t.montant, NULL::numeric
    FROM public.transactions t
   WHERE t.statut = 'valide' AND lower(coalesce(t.categorie, '')) IN ('salaire', 'salaires');
END $$;
REVOKE ALL ON FUNCTION public.controle_integrite_global() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.controle_integrite_global() TO authenticated;

-- Solde fournisseur (fonction de juin, plus utilisée par la clôture) : les transactions
-- annulées ou en attente ne sont pas des paiements.
CREATE OR REPLACE FUNCTION public.calcul_solde_fournisseur(_fournisseur_id uuid, _exercice_id uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_report numeric := 0;
  v_achats numeric := 0;
  v_paiements numeric := 0;
BEGIN
  SELECT COALESCE(SUM(montant), 0) INTO v_report
  FROM public.soldes_ouverture_fournisseurs
  WHERE fournisseur_id = _fournisseur_id AND exercice_id = _exercice_id;

  SELECT COALESCE(SUM(montant_total), 0) INTO v_achats
  FROM public.achats
  WHERE fournisseur_id = _fournisseur_id
    AND exercice_id = _exercice_id
    AND statut <> 'annule';

  -- Paiements fournisseurs = transactions 'depense' validées rattachées à ce fournisseur (best-effort)
  SELECT COALESCE(SUM(montant), 0) INTO v_paiements
  FROM public.transactions
  WHERE exercice_id = _exercice_id
    AND type = 'depense'
    AND statut = 'valide'
    AND reference ILIKE '%' || _fournisseur_id::text || '%';

  RETURN v_report + v_achats - v_paiements;
END;
$$;
