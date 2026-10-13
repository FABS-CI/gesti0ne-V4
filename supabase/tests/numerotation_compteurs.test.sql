-- Numérotation atomique : séquence continue, aucun doublon, aucune réutilisation.
-- À lancer dans une transaction annulée sur une base de test.
BEGIN;
DO $$
DECLARE refs text[] := '{}'; r text; i int; n0 int; n1 int;
BEGIN
  FOR i IN 1..20 LOOP
    refs := refs || public._next_ref('TST', 'public.factures', 'reference');
  END LOOP;
  IF (SELECT count(DISTINCT x) FROM unnest(refs) x) <> 20 THEN RAISE EXCEPTION 'doublon de référence'; END IF;
  n0 := substring(refs[1] from '-(\d+)$')::int;
  n1 := substring(refs[20] from '-(\d+)$')::int;
  IF n1 - n0 <> 19 THEN RAISE EXCEPTION 'trou dans la séquence'; END IF;
  -- « Suppression » du dernier document : le compteur ne recule jamais.
  r := public._next_ref('TST', 'public.factures', 'reference');
  IF substring(r from '-(\d+)$')::int <> n1 + 1 THEN RAISE EXCEPTION 'numéro réutilisé ou sauté'; END IF;
END $$;
ROLLBACK;
