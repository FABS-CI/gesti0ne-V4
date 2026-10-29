-- Vérifie que seuls les rôles habilités peuvent lire l'audit des annulations
-- de paiement et exécuter la RPC associée.
--
-- Usage: psql -X -v ON_ERROR_STOP=1 [-v strict=on] -f scripts/test-rls-audit.sql
-- Sortie attendue: chaque bloc affiche "PASS ..." ; toute exception = FAIL
-- et, grâce à ON_ERROR_STOP, un code de sortie non nul.
-- strict=on (CI) : un contrôle SKIP (droits insuffisants) est un échec, car un
-- test non exécuté ne doit jamais compter comme réussi.
--
-- Lecture seule : tout le script tourne dans une transaction READ ONLY, annulée
-- à la fin. Postgres refuse toute écriture, même par une fonction appelée.
--
-- IMPORTANT : la source de vérité des rôles est `rbac2_user_roles` /
-- `rbac2_roles` (moteur RBAC actif de l'application). La table legacy
-- `user_roles` (v0/v1) n'est plus référencée nulle part dans `src/` et ne doit
-- PAS être utilisée ici : elle donnerait un test toujours vert sur une table morte.

-- Une assertion en échec doit arrêter le script avec un code non nul.
-- (Auparavant « \set ON_ERROR_STOP off » ici annulait le -v ON_ERROR_STOP=1 de la CI :
-- psql sortait toujours avec 0 et le test ne pouvait pas échouer.)
\set ON_ERROR_STOP on
\if :{?strict}
\else
\set strict off
\endif

BEGIN TRANSACTION READ ONLY;
SELECT set_config('rls_audit.strict', :'strict', true);

DO $$
DECLARE
  v_admin uuid;
  v_user  uuid;
  v_count int;
BEGIN
  -- Utilisateur admin de test : rôle super_admin actif dans RBAC v2.
  SELECT ur.user_id INTO v_admin
    FROM public.rbac2_user_roles ur
    WHERE ur.role_code = 'super_admin'
    LIMIT 1;

  -- Utilisateur standard : possède au moins un rôle, mais aucun rôle admin/finance.
  SELECT ur.user_id INTO v_user
    FROM public.rbac2_user_roles ur
    WHERE ur.user_id IS DISTINCT FROM v_admin
      AND NOT EXISTS (
        SELECT 1 FROM public.rbac2_user_roles ur2
        WHERE ur2.user_id = ur.user_id
          AND ur2.role_code IN ('super_admin','directeur_general','comptable','assistante_comptable')
      )
    LIMIT 1;

  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'FAIL: aucun super_admin trouvé dans rbac2_user_roles — le test RBAC ne vérifie rien';
  END IF;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'FAIL: aucun utilisateur non-admin trouvé dans rbac2_user_roles — le test RBAC ne vérifie rien';
  END IF;
  RAISE NOTICE 'PASS: jeux d''utilisateurs de test résolus depuis rbac2_user_roles';

  -- 1) Le gate applicatif distingue bien admin et non-admin.
  BEGIN
    IF NOT public.is_admin(v_admin) THEN
      RAISE EXCEPTION 'FAIL: le super_admin rbac2 n''est pas reconnu par is_admin()';
    END IF;
    IF public.is_admin(v_user) OR public.is_finance(v_user) THEN
      RAISE EXCEPTION 'FAIL: un utilisateur standard est reconnu admin/finance';
    END IF;
    RAISE NOTICE 'PASS: is_admin/is_finance discriminent correctement les rôles rbac2';
  EXCEPTION WHEN insufficient_privilege THEN
    -- Rôle psql restreint (sandbox) : les checks structurels ci-dessous restent valides.
    IF current_setting('rls_audit.strict', true) = 'on' THEN
      RAISE EXCEPTION 'FAIL: contrôle 1 non exécuté (EXECUTE refusé sur is_admin/is_finance)';
    END IF;
    RAISE NOTICE 'SKIP: EXECUTE refusé sur is_admin/is_finance (rôle psql restreint)';
  END;


  -- 2) La policy SELECT de l'audit est bien gardée par un contrôle de rôle.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'paiement_annulations_audit'
      AND cmd = 'SELECT'
      AND (qual ILIKE '%is_admin%' OR qual ILIKE '%is_finance%' OR qual ILIKE '%has_permission%')
  ) THEN
    RAISE EXCEPTION 'FAIL: policy SELECT gardée manquante sur paiement_annulations_audit';
  END IF;
  RAISE NOTICE 'PASS: policy SELECT gardée en place sur l''audit';

  -- 3) L'écriture sur l'audit reste réservée à une permission explicite.
  SELECT count(*) INTO v_count FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'paiement_annulations_audit'
      AND cmd IN ('ALL','INSERT','UPDATE','DELETE')
      AND (qual IS NULL OR qual = 'true' OR with_check = 'true');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: policy d''écriture permissive détectée sur l''audit (%)', v_count;
  END IF;
  RAISE NOTICE 'PASS: écriture de l''audit verrouillée par permission';

  -- 4) RLS activée sur la table d'audit.
  SELECT count(*) INTO v_count FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'paiement_annulations_audit'
      AND c.relrowsecurity;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'FAIL: RLS non activée sur paiement_annulations_audit';
  END IF;
  RAISE NOTICE 'PASS: RLS activée';

  -- 5) RPC annuler_paiement(uuid,text,text) présente et SECURITY DEFINER.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'annuler_paiement'
      AND p.pronargs = 3
      AND p.prosecdef = true
  ) THEN
    RAISE EXCEPTION 'FAIL: annuler_paiement(uuid,text,text) SECURITY DEFINER manquante';
  END IF;
  RAISE NOTICE 'PASS: RPC annuler_paiement présente et SECURITY DEFINER';

  -- 6) Un utilisateur standard ne passerait pas le gate de la RPC.
  BEGIN
    IF public.is_admin(v_user)
       OR public.is_finance(v_user)
       OR public.has_permission(v_user, 'paiements.modifier') THEN
      RAISE EXCEPTION 'FAIL: un utilisateur standard passerait le gate RPC d''annulation';
    END IF;
    RAISE NOTICE 'PASS: gate RPC bloquerait un utilisateur standard';
  EXCEPTION WHEN insufficient_privilege THEN
    IF current_setting('rls_audit.strict', true) = 'on' THEN
      RAISE EXCEPTION 'FAIL: contrôle 6 non exécuté (EXECUTE refusé sur le gate RPC)';
    END IF;
    RAISE NOTICE 'SKIP: EXECUTE refusé sur le gate RPC (rôle psql restreint)';
  END;


  -- 7) Aucune policy anon sur l'audit ni sur paiements.
  SELECT count(*) INTO v_count FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('paiement_annulations_audit','paiements')
      AND 'anon' = ANY(roles);
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: policy anon détectée sur audit/paiements (%)', v_count;
  END IF;
  RAISE NOTICE 'PASS: pas d''accès anon';

  -- 8) Aucun GRANT anon sur l'audit ni sur paiements.
  SELECT count(*) INTO v_count FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name IN ('paiement_annulations_audit','paiements')
      AND grantee = 'anon';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: GRANT anon détecté sur audit/paiements (%)', v_count;
  END IF;
  RAISE NOTICE 'PASS: aucun GRANT anon';

  -- 9) SELECT sur paiements gardé par un contrôle de rôle/permission.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='paiements' AND cmd='SELECT'
      AND (qual ILIKE '%is_finance%' OR qual ILIKE '%is_admin%' OR qual ILIKE '%has_permission%')
  ) THEN
    RAISE EXCEPTION 'FAIL: SELECT paiements non gardé par un contrôle de rôle';
  END IF;
  RAISE NOTICE 'PASS: lecture des paiements réservée aux rôles habilités';

  -- 10) La table legacy user_roles ne doit plus servir de source de rôles.
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='user_roles') THEN
    SELECT count(*) INTO v_count FROM public.user_roles;
    RAISE NOTICE 'INFO: table legacy user_roles encore présente (% lignes) — suppression prévue', v_count;
  END IF;
END
$$;

-- 11) Anti-régression : aucune fonction SECURITY DEFINER exécutable par
-- anon/authenticated et qui écrit (INSERT/UPDATE/DELETE) ne doit être dépourvue
-- de contrôle de droit. Les fonctions trigger sont exclues (non appelables
-- directement). Gardes reconnues : assert_permission, rbac3_can, has_permission,
-- is_admin, is_finance, is_hr, is_stock, is_sales, has_role, is_super_admin,
-- can_write_module, rbac3_admin_guard.
DO $$
DECLARE
  v_list text;
  -- Liste blanche : fonctions internes légitimes sans contrôle propre.
  v_whitelist text[] := ARRAY[
    '_next_ref(text,regclass,text)',            -- numérotation, appelée par les RPC gardées
    '_notifier_role(text,text,text,text,text,text,uuid,text)', -- envoi de notifications internes
    '_recalc_solde_client_internal(uuid)',      -- recalcul dérivé, idempotent
    '_retour_audit(uuid,text,jsonb)',           -- journal des retours
    'log_audit_event(text,text,text,text,text,text,text,integer,jsonb,jsonb,jsonb,text,text,text,text,text,text,uuid,text,text,text,text,text,text,text,text,text,text,integer)', -- journal d'audit
    'log_permission_denied(text,jsonb)',        -- journal des refus
    'log_user_login(text,text,text)',           -- journal de connexion de l'appelant
    'rbac3_log(text,text,text,text,text,jsonb,jsonb)', -- journal RBAC
    'track_user_action(text,text,text,text,text)',     -- statistiques d'usage de l'appelant
    'next_client_code(text)'                    -- compteur de codes clients
  ];
BEGIN
  SELECT string_agg(p.oid::regprocedure::text, E'\n  ' ORDER BY 1) INTO v_list
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef AND p.prokind = 'f'
    AND p.prorettype <> 'trigger'::regtype
    AND (has_function_privilege('authenticated', p.oid, 'execute')
         OR has_function_privilege('anon', p.oid, 'execute'))
    AND pg_get_functiondef(p.oid) ~* '\m(insert\s+into|update\s+[a-z_."]+\s+set|delete\s+from)\M'
    AND pg_get_functiondef(p.oid) !~* '(assert_permission|rbac3_can|has_permission|is_admin|is_finance|is_hr|is_stock|is_sales|has_role|is_super_admin|can_write_module|rbac3_admin_guard)'
    AND NOT (regexp_replace(p.oid::regprocedure::text, '^public\.', '') = ANY (v_whitelist));
  IF v_list IS NOT NULL THEN
    RAISE EXCEPTION E'FAIL: fonctions SECURITY DEFINER sans contrôle de droit :\n  %', v_list;
  END IF;
  RAISE NOTICE 'PASS: toutes les fonctions SECURITY DEFINER qui écrivent ont un contrôle de droit';
END
$$;

ROLLBACK;