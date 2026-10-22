DO $$
DECLARE d text; n text;
BEGIN
  d := pg_get_functiondef('public.paie_enregistrer_bulletin'::regproc);
  n := replace(d, 'its := GREATEST(0, round(its_brut - ricf));', 'its := 0; -- ITS salarie 2024 nul (choix utilisateur)');
  IF n = d THEN RAISE EXCEPTION 'ligne ITS 2024 introuvable'; END IF;
  EXECUTE n;
END $$;