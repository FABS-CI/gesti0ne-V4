-- Paie : plafond CNPS des « autres branches » à 75 000 FCFA, paramètres contrôlés avant calcul.
--
-- 1. Plafond mensuel Prestations familiales / Maternité / Accidents du travail.
--    Source : CNPS, communiqué « Nouveau plafond des cotisations sociales de la CNPS »
--    (janvier 2023), en application du décret n° 2022-986 du 21/12/2022 (SMIG 75 000 FCFA) :
--    à compter du 01/01/2023, plafond retraite 3 375 000 FCFA, plafond des autres branches 75 000 FCFA.
--    Les deux régimes utilisaient 70 000 FCFA, plafond antérieur à 2023.
--    Paramètre daté (date_effet 2023-01-01) : les périodes antérieures gardent 70 000 FCFA.
--    Aucun bulletin enregistré n'est recalculé : ils gardent leurs lignes et leur snapshot.
-- 2. Le code CNPS_PATRONAL_AT affiché dans Paramètres Paie CI est relu par le moteur
--    (taux AT selon le risque de l'entreprise, 2 à 5 %) ; avant, seul CNPS_ACCIDENT_TRAVAIL l'était.
-- 3. _paie_parametres_controle : un paramètre obligatoire absent, négatif, un taux > 100 %
--    ou un barème incohérent bloque le calcul. Avant, un paramètre absent donnait des
--    montants NULL (LEAST ignore NULL, NULL * taux = NULL) enregistrés sans erreur.

INSERT INTO public.parametres_paie (cle, code, libelle, valeur, unite, categorie, actif, regime_code, date_effet, description)
VALUES ('PLAFOND_PRESTATIONS', 'PLAFOND_PRESTATIONS', 'Plafond CNPS Prestations familiales / Maternité / AT',
  '75000', 'plafond', 'cnps', true, NULL, DATE '2023-01-01',
  'Plafond mensuel des branches PF, maternité et AT. Source : communiqué CNPS (décret 2022-986 du 21/12/2022), en vigueur au 01/01/2023.')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public._paie_parametres_effectifs(p_regime text, p_date date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p jsonb; r record; k text;
BEGIN
  SELECT parametres INTO p FROM paie_regimes WHERE code = p_regime;
  p := COALESCE(p, '{}'::jsonb);
  FOR r IN SELECT cle, valeur FROM parametres_paie
    WHERE actif IS NOT FALSE AND (regime_code IS NULL OR regime_code = p_regime)
      AND (date_effet IS NULL OR date_effet <= p_date)
    ORDER BY (regime_code IS NOT NULL), date_effet NULLS FIRST
  LOOP
    k := CASE upper(r.cle)
      WHEN 'CNPS_RETRAITE_SALARIE' THEN 'cr_taux' WHEN 'CNPS_SALARIE_RETRAITE' THEN 'cr_taux'
      WHEN 'CNPS_RETRAITE_PATRONAL' THEN 'retraite_pat_taux' WHEN 'CNPS_PATRONAL_RETRAITE' THEN 'retraite_pat_taux'
      WHEN 'CNPS_ACCIDENT_TRAVAIL' THEN 'at_taux' WHEN 'CNPS_PATRONAL_AT' THEN 'at_taux'
      WHEN 'CMU_SALARIE' THEN 'cmu_salarie' WHEN 'CMU_PATRONAL' THEN 'cmu_patronal'
      ELSE lower(r.cle) END;
    IF p ? k AND r.valeur ~ '^-?[0-9]+(\.[0-9]+)?$' THEN p := p || jsonb_build_object(k, r.valeur::numeric);
    ELSIF k IN ('anciennete_taux_par_an','anciennete_plafond','jours_mois') AND r.valeur ~ '^[0-9]+(\.[0-9]+)?$' THEN
      p := p || jsonb_build_object(k, r.valeur::numeric);
    END IF;
  END LOOP;
  RETURN p;
END $$;
REVOKE ALL ON FUNCTION public._paie_parametres_effectifs(text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._paie_parametres_effectifs(text, date) TO authenticated;

-- Liste des problèmes des paramètres effectifs d'un régime ; tableau vide = paramètres utilisables.
CREATE OR REPLACE FUNCTION public._paie_parametres_controle(p_regime text, p jsonb) RETURNS text[]
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  err text[] := '{}'; k text; v numeric; t jsonb; prev numeric := 0; n int; i int := 0;
  taux text[] := ARRAY['cr_taux','retraite_pat_taux','pf_taux','at_taux'];
  montants text[] := ARRAY['cr_plafond','retraite_pat_plafond','plafond_prestations',
    'cmu_salarie','cmu_patronal','transport_plafond','arrondi_unite'];
BEGIN
  IF p_regime = 'REGIME_2022' THEN taux := taux || ARRAY['its_taux_forfait','cn_abattement'];
  ELSIF p_regime IS DISTINCT FROM 'REGIME_2024' THEN
    RETURN ARRAY['Régime de paie inconnu : ' || COALESCE(p_regime, 'NULL')];
  END IF;
  p := COALESCE(p, '{}'::jsonb);

  FOREACH k IN ARRAY taux || montants LOOP
    IF jsonb_typeof(p->k) IS DISTINCT FROM 'number' THEN
      err := err || ('Paramètre manquant ou non numérique : ' || k);
    ELSE
      v := (p->>k)::numeric;
      IF v < 0 THEN err := err || ('Paramètre négatif : ' || k);
      ELSIF k = ANY (taux) AND v > 100 THEN err := err || ('Taux supérieur à 100 % : ' || k);
      END IF;
    END IF;
  END LOOP;

  -- Barème progressif : [[borne, taux], …], bornes strictement croissantes, dernière borne null.
  k := CASE p_regime WHEN 'REGIME_2024' THEN 'its_bareme' ELSE 'cn_bareme' END;
  IF jsonb_typeof(p->k) IS DISTINCT FROM 'array' OR jsonb_array_length(p->k) = 0 THEN
    RETURN err || ('Barème manquant : ' || k);
  END IF;
  n := jsonb_array_length(p->k);
  FOR t IN SELECT x FROM jsonb_array_elements(p->k) x LOOP
    i := i + 1;
    IF jsonb_typeof(t) IS DISTINCT FROM 'array' OR jsonb_array_length(t) <> 2
       OR jsonb_typeof(t->1) IS DISTINCT FROM 'number' THEN
      err := err || format('Barème %s : tranche %s illisible', k, i);
      CONTINUE;
    END IF;
    IF (t->>1)::numeric < 0 OR (t->>1)::numeric > 100 THEN
      err := err || format('Barème %s : taux de la tranche %s hors de 0 à 100 %%', k, i);
    END IF;
    IF jsonb_typeof(t->0) = 'null' THEN
      IF i < n THEN err := err || format('Barème %s : tranche %s ouverte avant la dernière', k, i); END IF;
    ELSIF jsonb_typeof(t->0) IS DISTINCT FROM 'number' THEN
      err := err || format('Barème %s : borne de la tranche %s illisible', k, i);
    ELSE
      IF (t->>0)::numeric <= prev THEN
        err := err || format('Barème %s : bornes non croissantes à la tranche %s (chevauchement)', k, i);
      END IF;
      prev := (t->>0)::numeric;
      IF i = n THEN err := err || format('Barème %s : la dernière tranche doit être ouverte (borne null)', k); END IF;
    END IF;
  END LOOP;
  RETURN err;
END $$;
REVOKE ALL ON FUNCTION public._paie_parametres_controle(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._paie_parametres_controle(text, jsonb) TO authenticated;

-- Le moteur refuse de calculer avec des paramètres invalides (bulletin, aperçu et génération).
DO $$
DECLARE d text; n text;
BEGIN
  d := pg_get_functiondef('public.paie_calculer_bulletin(uuid, date, date, jsonb)'::regprocedure);
  n := replace(d, '  p := _paie_parametres_effectifs(v_reg, p_date_fin);',
    '  p := _paie_parametres_effectifs(v_reg, p_date_fin);
  IF cardinality(_paie_parametres_controle(v_reg, p)) > 0 THEN
    RAISE EXCEPTION ''Paramètres de paie invalides (%) : %'', v_reg, array_to_string(_paie_parametres_controle(v_reg, p), '' ; '');
  END IF;');
  IF n = d THEN RAISE EXCEPTION 'paie_calculer_bulletin : point d''insertion du contrôle introuvable'; END IF;
  EXECUTE n;
END $$;
