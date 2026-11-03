-- Tableau de bord comptable (audit Comptabilité, phase 3).
--
-- Indicateurs d'un exercice, calculés en une fois sur les écritures :
--   - activité : écritures par statut, comptes mouvementés, totaux débit / crédit,
--     soldes débiteurs et créditeurs de la balance de l'exercice ;
--   - résultat : produits (classe 7), charges (classe 6), activités hors ordinaires
--     (classe 8), chiffre d'affaires (comptes 70) ;
--   - situation à la date de fin (ou au jour si l'exercice est en cours), sur la balance
--     cumulée : trésorerie (classe 5), créances clients (41), dettes fournisseurs (40),
--     dettes sociales et fiscales (42 à 44). Calculer ces postes sur les seuls
--     mouvements de l'exercice oubliait les soldes d'ouverture ;
--   - évolution mensuelle et répartition des charges par compte principal (60 à 69).
-- Lecture seule ; aucune donnée n'est estimée : un mois sans écriture vaut zéro.

CREATE OR REPLACE FUNCTION public.compta_tableau_de_bord(p_exercice_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_debut date; v_fin date; v_situation date;
  r jsonb;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'comptabilite.voir') THEN
    RAISE EXCEPTION 'Permission refusée : comptabilite.voir' USING ERRCODE = '42501';
  END IF;
  SELECT date_debut, date_fin INTO v_debut, v_fin
    FROM public.exercices_comptables WHERE exercice_id = p_exercice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exercice inconnu'; END IF;
  v_situation := least(v_fin, greatest(current_date, v_debut));

  WITH l AS (
    SELECT coalesce(nullif(btrim(el.numero_compte), ''), pci.numero, '') AS num,
           coalesce(el.debit, 0) AS d, coalesce(el.credit, 0) AS c,
           ec.date_ecriture AS dt
      FROM public.ecriture_lignes el
      JOIN public.ecritures_comptables ec ON ec.ecriture_id = el.ecriture_id
      LEFT JOIN public.plan_comptable pci ON pci.compte_id = el.compte_id
     WHERE ec.date_ecriture <= v_fin
  ), periode AS (
    SELECT * FROM l WHERE l.dt >= v_debut
  ), comptes AS (
    SELECT p.num, sum(p.d - p.c) AS solde FROM periode p GROUP BY p.num
  ), cumul AS (
    SELECT l.num, sum(l.d - l.c) AS solde FROM l WHERE l.dt <= v_situation GROUP BY l.num
  ), ecr AS (
    SELECT e.statut, e.contrepassee_le, e.contrepassation_de
      FROM public.ecritures_comptables e
     WHERE e.date_ecriture BETWEEN v_debut AND v_fin
  ), mois AS (
    SELECT m::date AS mois FROM generate_series(date_trunc('month', v_debut), v_fin, interval '1 month') m
  )
  SELECT jsonb_build_object(
    'periode', jsonb_build_object('debut', v_debut, 'fin', v_fin, 'situation', v_situation),
    'ecritures', jsonb_build_object(
      'total', (SELECT count(*) FROM ecr),
      'validees', (SELECT count(*) FROM ecr WHERE public._compta_statut_valide(ecr.statut)
                     AND ecr.contrepassee_le IS NULL AND ecr.contrepassation_de IS NULL),
      'brouillons', (SELECT count(*) FROM ecr WHERE NOT public._compta_statut_valide(ecr.statut)
                       AND ecr.contrepassee_le IS NULL AND ecr.contrepassation_de IS NULL),
      -- Annulées : écritures contre-passées et leurs écritures inverses (l'ERP ne rejette
      -- pas d'écriture : une erreur se corrige par contre-passation).
      'annulees', (SELECT count(*) FROM ecr WHERE ecr.contrepassee_le IS NOT NULL
                     OR ecr.contrepassation_de IS NOT NULL)),
    'mouvements', jsonb_build_object(
      'debit', (SELECT coalesce(round(sum(d), 2), 0) FROM periode),
      'credit', (SELECT coalesce(round(sum(c), 2), 0) FROM periode),
      'soldes_debiteurs', (SELECT coalesce(round(sum(solde), 2), 0) FROM comptes WHERE solde > 0),
      'soldes_crediteurs', (SELECT coalesce(round(-sum(solde), 2), 0) FROM comptes WHERE solde < 0),
      'comptes_mouvementes', (SELECT count(DISTINCT num) FROM periode)),
    'resultat', jsonb_build_object(
      'chiffre_affaires', (SELECT coalesce(round(-sum(solde), 2), 0) FROM comptes WHERE left(num, 2) = '70'),
      'produits', (SELECT coalesce(round(-sum(solde), 2), 0) FROM comptes WHERE left(num, 1) = '7'),
      'charges', (SELECT coalesce(round(sum(solde), 2), 0) FROM comptes WHERE left(num, 1) = '6'),
      'hao', (SELECT coalesce(round(-sum(solde), 2), 0) FROM comptes WHERE left(num, 1) = '8'),
      'resultat', (SELECT coalesce(round(-sum(solde), 2), 0) FROM comptes WHERE left(num, 1) IN ('6', '7', '8'))),
    'situation', jsonb_build_object(
      'tresorerie', (SELECT coalesce(round(sum(solde), 2), 0) FROM cumul WHERE left(num, 1) = '5'),
      'creances_clients', (SELECT coalesce(round(sum(solde), 2), 0) FROM cumul WHERE left(num, 2) = '41'),
      'dettes_fournisseurs', (SELECT coalesce(round(-sum(solde), 2), 0) FROM cumul WHERE left(num, 2) = '40'),
      'dettes_sociales_fiscales', (SELECT coalesce(round(-sum(solde), 2), 0) FROM cumul WHERE left(num, 2) IN ('42', '43', '44'))),
    'mensuel', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'mois', to_char(mois.mois, 'YYYY-MM'),
        'chiffre_affaires', coalesce(round(x.ca, 2), 0),
        'produits', coalesce(round(x.produits, 2), 0),
        'charges', coalesce(round(x.charges, 2), 0),
        'resultat', coalesce(round(x.resultat, 2), 0)) ORDER BY mois.mois), '[]'::jsonb)
      FROM mois
      LEFT JOIN LATERAL (
        SELECT sum(CASE WHEN left(p.num, 2) = '70' THEN p.c - p.d END) AS ca,
               sum(CASE WHEN left(p.num, 1) = '7' THEN p.c - p.d END) AS produits,
               sum(CASE WHEN left(p.num, 1) = '6' THEN p.d - p.c END) AS charges,
               sum(CASE WHEN left(p.num, 1) IN ('6', '7', '8') THEN p.c - p.d END) AS resultat
          FROM periode p WHERE date_trunc('month', p.dt) = mois.mois
      ) x ON true),
    'charges_par_compte', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'compte', z.cpt, 'libelle', coalesce(pc.libelle, 'Compte ' || z.cpt),
        'montant', round(z.montant, 2)) ORDER BY z.montant DESC), '[]'::jsonb)
      FROM (SELECT left(num, 2) AS cpt, sum(solde) AS montant FROM comptes
             WHERE left(num, 1) = '6' GROUP BY 1 HAVING sum(solde) <> 0) z
      LEFT JOIN public.plan_comptable pc ON pc.numero = z.cpt)
  ) INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.compta_tableau_de_bord(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.compta_tableau_de_bord(uuid) TO authenticated;
