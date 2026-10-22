UPDATE public.paie_regimes SET parametres = parametres || '{"arrondi_unite":5,"arrondi_mode":"superieur"}'::jsonb;
DO $$
DECLARE d text; n text;
BEGIN
  d := pg_get_functiondef('public.paie_enregistrer_bulletin'::regproc);
  n := replace(d, 'net := round(net_av / unite) * unite;',
    'net := CASE WHEN COALESCE(p->>''arrondi_mode'',''superieur'') = ''proche'' THEN round(net_av / unite) ELSE ceil(net_av / unite) END * unite;');
  IF n = d THEN RAISE EXCEPTION 'ligne arrondi introuvable'; END IF;
  EXECUTE n;
END $$;