-- Validation comptable d'un retour : valeur calculée par le serveur, avoir numéroté par _next_ref.
--
-- Avant (0057) : _retour_valider_compta_core prenait la valeur dans _montants, envoyé par le
-- navigateur. L'écran de validation n'envoie aucun montant ({}) : chaque retour validé à la main
-- était enregistré à 0 FCFA (aucune baisse de solde, avoir à 0). Un appel direct pouvait aussi
-- fixer n'importe quelle valeur. Les avoirs étaient numérotés AV-AAAAMMJJ-xxxxxx (aléatoire).
--
-- Désormais :
--   * valeur = total des lignes du retour - remise globale (même formule que _retour_recalc_totaux,
--     donc que retours.montant affiché) ; _montants n'est plus qu'une trace dans l'approbation ;
--   * l'avoir prend le numéro suivant AV-AAAA-NNNNN (compteur numerotation_compteurs).

CREATE OR REPLACE FUNCTION public._retour_valeur(_retour_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT agg.montant - ROUND(agg.montant * COALESCE(r.remise_globale_pct, 0) / 100.0)
  FROM public.retours r
  CROSS JOIN LATERAL (
    SELECT COALESCE(sum(rl.total_ligne), 0) AS montant
    FROM public.retour_lignes rl WHERE rl.retour_id = r.retour_id
  ) agg
  WHERE r.retour_id = _retour_id
$$;
REVOKE ALL ON FUNCTION public._retour_valeur(uuid) FROM PUBLIC, anon, authenticated;

DO $$
DECLARE d text; o text;
  v_val_avant text := $x$v_valeur numeric := COALESCE((_montants->>'valeur_retour')::numeric, COALESCE((_montants->>'montant_total')::numeric, 0));$x$;
  v_val_apres text := $x$v_valeur numeric := COALESCE(public._retour_valeur(_retour_id), 0);$x$;
  v_ref_avant text := $x$VALUES ('AV-'||to_char(now(),'YYYYMMDD')||'-'||substr(gen_random_uuid()::text,1,6),$x$;
  v_ref_apres text := $x$VALUES (public._next_ref('AV', 'public.factures'::regclass, 'reference'),$x$;
BEGIN
  d := pg_get_functiondef('public._retour_valider_compta_core(uuid,text,jsonb,text)'::regprocedure); o := d;
  IF position('_retour_valeur(_retour_id)' in d) > 0 THEN RETURN; END IF; -- déjà appliquée
  d := replace(d, v_val_avant, v_val_apres);
  d := replace(d, v_ref_avant, v_ref_apres);
  IF position(v_val_apres in d) = 0 OR position(v_ref_apres in d) = 0 THEN
    RAISE EXCEPTION '_retour_valider_compta_core : remplacement impossible (texte attendu introuvable)';
  END IF;
  EXECUTE d;
END $$;
