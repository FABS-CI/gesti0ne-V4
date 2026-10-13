-- 4.4 Compteurs de numérotation
CREATE TABLE IF NOT EXISTS public.numerotation_compteurs (
  type_doc text NOT NULL,
  annee int NOT NULL,
  dernier_numero int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (type_doc, annee)
);
GRANT SELECT ON public.numerotation_compteurs TO authenticated;
GRANT ALL ON public.numerotation_compteurs TO service_role;
ALTER TABLE public.numerotation_compteurs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lecture compteurs" ON public.numerotation_compteurs FOR SELECT TO authenticated USING (true);

DO $$
DECLARE r record; v_sql text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('CMD','public.commandes'),('FAC','public.factures'),('BL','public.bons_livraison'),
    ('PRO','public.proformas'),('PAI','public.paiements'),('RET','public.retours'),
    ('SPC','public.specimens'),('INC','public.incidents'),('INV','public.inventaires'),('APP','public.achats')
  ) AS t(prefix, tbl) LOOP
    v_sql := format($f$
      INSERT INTO public.numerotation_compteurs(type_doc, annee, dernier_numero)
      SELECT %L, substring(reference from '^%s-(\d{4})-')::int, MAX(substring(reference from '-(\d+)$')::int)
      FROM %s WHERE reference ~ '^%s-\d{4}-\d+$' GROUP BY 2
      ON CONFLICT (type_doc, annee) DO UPDATE
        SET dernier_numero = GREATEST(numerotation_compteurs.dernier_numero, EXCLUDED.dernier_numero), updated_at = now()
    $f$, r.prefix, r.prefix, r.tbl, r.prefix);
    EXECUTE v_sql;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public._next_ref(_prefix text, _table regclass, _col text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_year int := extract(year from now())::int; v_n int;
BEGIN
  INSERT INTO public.numerotation_compteurs(type_doc, annee, dernier_numero, updated_at)
  VALUES (_prefix, v_year, 1, now())
  ON CONFLICT (type_doc, annee) DO UPDATE
    SET dernier_numero = numerotation_compteurs.dernier_numero + 1, updated_at = now()
  RETURNING dernier_numero INTO v_n;
  RETURN _prefix || '-' || v_year || '-' || lpad(v_n::text, 5, '0');
END; $function$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_commandes_reference ON public.commandes(reference) WHERE reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_factures_reference ON public.factures(reference) WHERE reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_proformas_reference ON public.proformas(reference) WHERE reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_bons_livraison_reference ON public.bons_livraison(reference) WHERE reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_paiements_reference ON public.paiements(reference) WHERE reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_retours_reference ON public.retours(reference) WHERE reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_specimens_reference ON public.specimens(reference) WHERE reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_incidents_reference ON public.incidents(reference) WHERE reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_inventaires_reference ON public.inventaires(reference) WHERE reference IS NOT NULL;

-- valider_commande : références calculées après le verrou de la commande
DO $$
DECLARE d text; o text;
BEGIN
  d := pg_get_functiondef('public.valider_commande(uuid,text,numeric)'::regprocedure); o := d;
  d := replace(d, $x$v_f_ref text := public._next_ref('FAC', 'public.factures', 'reference');$x$, 'v_f_ref text;');
  d := replace(d, $x$v_bl_ref text := public._next_ref('BL', 'public.bons_livraison', 'reference');$x$, 'v_bl_ref text;');
  d := replace(d, $x$IF v_cmd.statut = 'annulee' THEN RAISE EXCEPTION 'Commande annulée, impossible à valider'; END IF;$x$,
    $x$IF v_cmd.statut = 'annulee' THEN RAISE EXCEPTION 'Commande annulée, impossible à valider'; END IF;
  v_f_ref := public._next_ref('FAC', 'public.factures', 'reference');
  v_bl_ref := public._next_ref('BL', 'public.bons_livraison', 'reference');$x$);
  IF d = o OR position('v_f_ref := public._next_ref' in d) = 0 OR position('v_f_ref text;' in d) = 0 THEN
    RAISE EXCEPTION 'valider_commande : remplacement impossible';
  END IF;
  EXECUTE d;
END $$;

-- 4.3 Validations serveur de creer_commande / modifier_commande
DO $$
DECLARE d text; o text;
  v_line_checks text := $x$
    IF v_qte_l <= 0 THEN RAISE EXCEPTION 'Quantité invalide (%) : elle doit être supérieure à 0', v_qte_l USING ERRCODE = 'P0001'; END IF;
    IF v_qte_l <> trunc(v_qte_l) THEN RAISE EXCEPTION 'Quantité non entière (%) refusée', v_qte_l USING ERRCODE = 'P0001'; END IF;
    IF v_pu < 0 THEN RAISE EXCEPTION 'Prix unitaire négatif refusé (%)', v_pu USING ERRCODE = 'P0001'; END IF;
    IF v_rpct < 0 OR v_rpct > 100 THEN RAISE EXCEPTION 'Remise de ligne hors de 0 à 100 %% (%)', v_rpct USING ERRCODE = 'P0001'; END IF;$x$;
  v_glob_checks text := $x$
      IF v_remise_g < 0 OR v_remise_g > 100 THEN RAISE EXCEPTION 'Remise globale hors de 0 à 100 %% (%)', v_remise_g USING ERRCODE = 'P0001'; END IF;
      IF v_tva < 0 OR v_tva > 100 THEN RAISE EXCEPTION 'Taux de TVA hors de 0 à 100 %% (%)', v_tva USING ERRCODE = 'P0001'; END IF;$x$;
BEGIN
  d := pg_get_functiondef('public.creer_commande(jsonb)'::regprocedure); o := d;
  d := replace(d, $x$PERFORM public.assert_permission('commandes.creer');$x$, $x$PERFORM public.assert_permission('commandes.creer');$x$ || v_glob_checks);
  d := replace(d, $x$v_rpct := COALESCE((v_ligne->>'remise_pct')::numeric, 0);$x$, $x$v_rpct := COALESCE((v_ligne->>'remise_pct')::numeric, 0);$x$ || v_line_checks);
  d := replace(d, 'v_qte_l::int', 'v_qte_l');
  IF d = o OR position('Remise globale hors' in d) = 0 OR position('Quantité invalide' in d) = 0 OR position('v_qte_l::int' in d) > 0 THEN
    RAISE EXCEPTION 'creer_commande : remplacement impossible';
  END IF;
  EXECUTE d;

  d := pg_get_functiondef('public.modifier_commande(uuid,jsonb)'::regprocedure); o := d;
  d := replace(d, $x$v_remise_g := COALESCE((_payload->>'remise_globale_pct')::numeric, v_remise_g);$x$, $x$v_remise_g := COALESCE((_payload->>'remise_globale_pct')::numeric, v_remise_g);$x$ || v_glob_checks);
  d := replace(d, $x$v_rpct  := COALESCE((v_ligne->>'remise_pct')::numeric, 0);$x$, $x$v_rpct  := COALESCE((v_ligne->>'remise_pct')::numeric, 0);$x$ || v_line_checks);
  d := replace(d, 'v_qte_l::int', 'v_qte_l');
  IF d = o OR position('Remise globale hors' in d) = 0 OR position('Quantité invalide' in d) = 0 OR position('v_qte_l::int' in d) > 0 THEN
    RAISE EXCEPTION 'modifier_commande : remplacement impossible';
  END IF;
  EXECUTE d;
END $$;

ALTER TABLE public.commande_lignes ADD CONSTRAINT ck_commande_lignes_quantite_pos CHECK (quantite > 0) NOT VALID;
ALTER TABLE public.commande_lignes ADD CONSTRAINT ck_commande_lignes_prix_pos CHECK (prix_unitaire >= 0) NOT VALID;
ALTER TABLE public.commande_lignes ADD CONSTRAINT ck_commande_lignes_remise_pct CHECK (remise_pct >= 0 AND remise_pct <= 100) NOT VALID;

-- 4.2 Alerte d'écart entre total recalculé et total stocké (sans bloquer le PDF)
CREATE OR REPLACE FUNCTION public.signaler_ecart_total_document(_type text, _reference text, _stocke numeric, _calcule numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR abs(COALESCE(_stocke,0) - COALESCE(_calcule,0)) < 1 THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.incident_alerts WHERE source = 'pdf_total_coherence' AND resolved = false
             AND metadata->>'reference' = _reference) THEN RETURN; END IF;
  INSERT INTO public.incident_alerts(title, message, severity, source, metadata)
  VALUES ('Écart de total sur un document',
          format('%s %s : total enregistré %s, total recalculé %s', _type, _reference, _stocke, _calcule),
          'warning', 'pdf_total_coherence',
          jsonb_build_object('type', _type, 'reference', _reference, 'stocke', _stocke, 'calcule', _calcule, 'user_id', auth.uid()));
END; $function$;
REVOKE ALL ON FUNCTION public.signaler_ecart_total_document(text,text,numeric,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.signaler_ecart_total_document(text,text,numeric,numeric) TO authenticated;