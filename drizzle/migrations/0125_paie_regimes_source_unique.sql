CREATE TABLE IF NOT EXISTS public.paie_regimes_historique (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regime_code text NOT NULL,
  anciens jsonb,
  nouveaux jsonb NOT NULL,
  modifie_par uuid,
  modifie_par_nom text,
  modifie_le timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.paie_regimes_historique TO authenticated;
GRANT ALL ON public.paie_regimes_historique TO service_role;
ALTER TABLE public.paie_regimes_historique ENABLE ROW LEVEL SECURITY;
CREATE POLICY paie_regimes_historique_read ON public.paie_regimes_historique
  FOR SELECT TO authenticated
  USING (public.is_hr(auth.uid()) OR public.has_permission(auth.uid(), 'paie.voir'));

-- Une seule source : les paramètres du régime. L'ancienne table de surcharges n'est plus lue
-- (ses valeurs actives étaient identiques à celles des régimes, donc aucun calcul ne change).
CREATE OR REPLACE FUNCTION public._paie_parametres_effectifs(p_regime text, p_date date)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT COALESCE((SELECT parametres FROM paie_regimes WHERE code = p_regime), '{}'::jsonb) $$;
REVOKE EXECUTE ON FUNCTION public._paie_parametres_effectifs(text, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.paie_regime_enregistrer(_code text, _parametres jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_old jsonb; v_new jsonb; k text; v jsonb; t jsonb; i int; n int;
  numeriques text[] := ARRAY['cr_taux','cr_plafond','cmu_salarie','cmu_patronal','transport_plafond','arrondi_unite',
    'retraite_pat_taux','retraite_pat_plafond','pf_taux','maternite_taux','at_taux','plafond_prestations','fdfp_taux',
    'its_taux_forfait','ricf_par_demi_part','cn_abattement','anciennete_taux_par_an','anciennete_plafond','jours_mois'];
  taux text[] := ARRAY['cr_taux','retraite_pat_taux','pf_taux','maternite_taux','at_taux','fdfp_taux','its_taux_forfait',
    'cn_abattement','anciennete_taux_par_an','anciennete_plafond'];
BEGIN
  PERFORM public.assert_permission('rh.modifier');
  SELECT parametres INTO v_old FROM paie_regimes WHERE code = _code FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Régime de paie inconnu : %', _code; END IF;
  IF _parametres IS NULL OR jsonb_typeof(_parametres) <> 'object' THEN RAISE EXCEPTION 'Paramètres invalides'; END IF;
  v_new := COALESCE(v_old, '{}'::jsonb);
  FOR k, v IN SELECT * FROM jsonb_each(_parametres) LOOP
    IF k = ANY(numeriques) THEN
      IF jsonb_typeof(v) <> 'number' OR (v #>> '{}')::numeric < 0 THEN RAISE EXCEPTION 'Valeur invalide pour %', k; END IF;
      IF k = ANY(taux) AND (v #>> '{}')::numeric > 100 THEN RAISE EXCEPTION 'Le taux % ne peut pas dépasser 100 %%', k; END IF;
      IF k = 'arrondi_unite' AND (v #>> '{}')::numeric < 1 THEN RAISE EXCEPTION 'L''unité d''arrondi doit être au moins 1'; END IF;
      IF k = 'jours_mois' AND (v #>> '{}')::numeric < 1 THEN RAISE EXCEPTION 'Le nombre de jours par mois doit être au moins 1'; END IF;
    ELSIF k = 'fdfp_actif' THEN
      IF jsonb_typeof(v) <> 'boolean' THEN RAISE EXCEPTION 'Valeur invalide pour %', k; END IF;
    ELSIF k = 'arrondi_mode' THEN
      IF v #>> '{}' NOT IN ('superieur','proche') THEN RAISE EXCEPTION 'Mode d''arrondi invalide'; END IF;
    ELSIF k IN ('its_bareme','cn_bareme') THEN
      IF jsonb_typeof(v) <> 'array' THEN RAISE EXCEPTION 'Barème invalide : %', k; END IF;
      n := jsonb_array_length(v);
      FOR i IN 0 .. n - 1 LOOP
        t := v -> i;
        IF jsonb_typeof(t) <> 'array' OR jsonb_array_length(t) <> 2
          OR jsonb_typeof(t->1) <> 'number' OR (t->>1)::numeric < 0 OR (t->>1)::numeric > 100
          OR NOT (jsonb_typeof(t->0) = 'number' OR (jsonb_typeof(t->0) = 'null' AND i = n - 1))
          OR (i > 0 AND jsonb_typeof(t->0) = 'number' AND (t->>0)::numeric <= (v->(i-1)->>0)::numeric) THEN
          RAISE EXCEPTION 'Barème % : tranche % invalide (plafonds croissants, taux entre 0 et 100, dernière tranche sans plafond)', k, i + 1;
        END IF;
      END LOOP;
    ELSE
      RAISE EXCEPTION 'Paramètre inconnu : %', k;
    END IF;
    v_new := v_new || jsonb_build_object(k, v);
  END LOOP;
  IF v_new IS DISTINCT FROM v_old THEN
    UPDATE paie_regimes SET parametres = v_new, updated_at = now() WHERE code = _code;
    INSERT INTO paie_regimes_historique(regime_code, anciens, nouveaux, modifie_par, modifie_par_nom)
    VALUES (_code, v_old, v_new, auth.uid(), public._current_user_display_name());
  END IF;
  RETURN v_new;
END $$;
REVOKE EXECUTE ON FUNCTION public.paie_regime_enregistrer(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.paie_regime_enregistrer(text, jsonb) TO authenticated;

COMMENT ON TABLE public.parametres_paie IS 'DEPRECATED: la paie lit uniquement paie_regimes.parametres (édités via paie_regime_enregistrer).';