-- Diagnostic des paramètres de paie — LECTURE SEULE (transaction READ ONLY annulée).
-- À lancer dans Supabase → SQL Editor. Ne modifie aucune donnée.
--
-- 1. Lignes de « Paramètres Paie CI » : lesquelles le moteur lit réellement ?
-- 2. Paramètres effectifs du moteur en 2023 et aujourd'hui.
-- 3. Impact de l'ITS forcé à 0 : ITS du barème 2024 non retenu sur les bulletins enregistrés.

BEGIN TRANSACTION READ ONLY;

-- 1. Le moteur lit la colonne `cle` (pas `code`), uniquement si la valeur est un nombre
--    et si la clé existe dans le régime (ou via un alias CNPS/CMU).
SELECT pp.cle, pp.code, pp.valeur, pp.actif, pp.regime_code, pp.date_effet,
       CASE WHEN pp.actif IS FALSE THEN 'inactif'
            WHEN pp.valeur !~ '^-?[0-9]+(\.[0-9]+)?$' THEN 'IGNORÉ : valeur non numérique'
            WHEN upper(pp.cle) IN ('CNPS_RETRAITE_SALARIE','CNPS_SALARIE_RETRAITE','CNPS_RETRAITE_PATRONAL',
                 'CNPS_PATRONAL_RETRAITE','CNPS_ACCIDENT_TRAVAIL','CNPS_PATRONAL_AT','CMU_SALARIE','CMU_PATRONAL')
              OR (SELECT parametres FROM paie_regimes WHERE code = 'REGIME_2024') ? lower(pp.cle)
              OR lower(pp.cle) IN ('anciennete_taux_par_an','anciennete_plafond','jours_mois')
            THEN 'UTILISÉ par le calcul'
            ELSE 'IGNORÉ : code inconnu du moteur' END AS effet
FROM parametres_paie pp
ORDER BY effet, pp.cle;

-- 2. Paramètres réellement appliqués (CMU attendue : 500 / 500 ; plafond PF/AT : 75 000).
SELECT 'Décembre 2023 (régime 2022)' AS periode, _paie_parametres_effectifs('REGIME_2022', DATE '2023-12-31') AS parametres
UNION ALL
SELECT 'Aujourd''hui (régime 2024)', _paie_parametres_effectifs('REGIME_2024', CURRENT_DATE);

-- 3. Bulletins depuis 2024 : ITS retenu vs ITS du barème 2024 après réduction pour charges
--    de famille (5 500 FCFA par demi-part au-delà de 1 part). Estimation à valider par le comptable.
WITH b AS (
  SELECT bp.reference, bp.employe_nom, bp.date_fin, bp.statut, bp.brut_imposable, COALESCE(bp.parts, 1) AS parts,
         COALESCE((SELECT sum(l.retenue) FROM bulletin_lignes l
                   WHERE l.bulletin_id = bp.bulletin_id AND l.numero_rubrique IN ('401','413')), 0) AS its_retenu,
         GREATEST(0, round(_paie_bareme(bp.brut_imposable, r.parametres->'its_bareme'))
                     - round((COALESCE(bp.parts, 1) - 1) * 2) * (r.parametres->>'ricf_par_demi_part')::numeric) AS its_bareme
  FROM bulletins_paie bp CROSS JOIN paie_regimes r
  WHERE r.code = 'REGIME_2024' AND bp.date_fin >= DATE '2024-01-01' AND bp.brut_imposable IS NOT NULL
)
SELECT count(*) AS bulletins, count(*) FILTER (WHERE its_bareme > its_retenu) AS bulletins_concernes,
       sum(its_retenu) AS its_retenu_total, sum(its_bareme) AS its_bareme_total,
       sum(its_bareme - its_retenu) AS ecart_total
FROM b;

ROLLBACK;
