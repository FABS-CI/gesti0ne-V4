-- Audit sécurité (fichier-56, §1-3) — lot A.

-- 1. Fonctions SECURITY DEFINER : plus d'exécution par anon (ni PUBLIC),
--    sauf get_carton_public (page publique du QR carton).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid, p.oid::regprocedure AS sig, (p.prorettype = 'trigger'::regtype) AS is_trigger
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef AND p.proname <> 'get_carton_public'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    IF r.is_trigger THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.sig);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- 2. Contrôles de permission serveur manquants (RBAC existant via assert_permission).
DO $$
DECLARE d text; n text;
BEGIN
  -- approbation_deleguer : réservé aux approbateurs.
  d := pg_get_functiondef('public.approbation_deleguer(uuid,uuid,text,timestamptz)'::regprocedure);
  n := replace(d,
    'IF v_actor IS NULL THEN RAISE EXCEPTION ''Non authentifié''; END IF;',
    'IF v_actor IS NULL THEN RAISE EXCEPTION ''Non authentifié''; END IF;' || E'\n  PERFORM public.assert_permission(''approbations.valider'');');
  IF n = d THEN RAISE EXCEPTION 'approbation_deleguer : point d''insertion introuvable'; END IF;
  EXECUTE n;

  -- approbation_escalader_sla : appel système (sans utilisateur) ou utilisateur ayant accès aux approbations.
  d := pg_get_functiondef('public.approbation_escalader_sla()'::regprocedure);
  n := regexp_replace(d, E'\\nBEGIN\\n',
    E'\nBEGIN\n  IF auth.uid() IS NOT NULL THEN PERFORM public.assert_permission(''approbations.voir''); END IF;\n');
  IF n = d THEN RAISE EXCEPTION 'approbation_escalader_sla : point d''insertion introuvable'; END IF;
  EXECUTE n;

  -- retour_creer_demande : droit de création de retour.
  d := pg_get_functiondef('public.retour_creer_demande(jsonb)'::regprocedure);
  n := regexp_replace(d, E'\\nBEGIN\\n',
    E'\nBEGIN\n  PERFORM public.assert_permission(''retours.creer'');\n');
  IF n = d THEN RAISE EXCEPTION 'retour_creer_demande : point d''insertion introuvable'; END IF;
  EXECUTE n;
END $$;

-- 3. fournisseurs : la policy ALL « auth.uid() IS NOT NULL » ouvrait lecture et écriture
--    à tout utilisateur connecté (OR avec la policy de lecture). Remplacée par les droits RBAC.
DROP POLICY IF EXISTS "fournisseurs write auth" ON public.fournisseurs;
CREATE POLICY fournisseurs_insert_perm ON public.fournisseurs FOR INSERT TO authenticated
  WITH CHECK (public.has_permission_v2(auth.uid(), 'fournisseurs.creer'));
CREATE POLICY fournisseurs_update_perm ON public.fournisseurs FOR UPDATE TO authenticated
  USING (public.has_permission_v2(auth.uid(), 'fournisseurs.modifier'))
  WITH CHECK (public.has_permission_v2(auth.uid(), 'fournisseurs.modifier'));
CREATE POLICY fournisseurs_delete_perm ON public.fournisseurs FOR DELETE TO authenticated
  USING (public.has_permission_v2(auth.uid(), 'fournisseurs.supprimer'));

-- 4. rbac3_audit : insertion directe ouverte (WITH CHECK true) supprimée ;
--    le journal est alimenté par les fonctions serveur.
DROP POLICY IF EXISTS "audit insertion" ON public.rbac3_audit;