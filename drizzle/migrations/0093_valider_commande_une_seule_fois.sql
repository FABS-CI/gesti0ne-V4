-- valider_commande : une commande n'est validée (facture + BL + sortie de stock) qu'une seule fois.
--
-- Avant : seuls les statuts « validee » et « annulee » étaient bloqués. Une commande passée ensuite
-- à livraison_en_cours, livree, etc. pouvait être validée de nouveau : deuxième facture, deuxième BL,
-- deuxième sortie de stock. Aucune contrainte n'empêchait deux factures pour une même commande.
--
-- Désormais, sous le verrou de la commande (déjà pris par la fonction) :
--   * seuls les statuts d'avant validation sont acceptés ;
--   * une commande qui a déjà une facture non annulée est refusée.

DO $$
DECLARE d text; o text;
  v_ancre text := $x$IF v_cmd.statut = 'annulee' THEN RAISE EXCEPTION 'Commande annulée, impossible à valider'; END IF;$x$;
  v_garde text := $x$
  IF v_cmd.statut NOT IN ('brouillon', 'soumise', 'en_attente', 'en_attente_validation', 'confirmee') THEN
    RAISE EXCEPTION 'Commande déjà traitée (statut %) : validation impossible', v_cmd.statut USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.factures f
              WHERE f.commande_id = _commande_id AND COALESCE(f.statut, '') NOT IN ('annule', 'annulee')) THEN
    RAISE EXCEPTION 'Cette commande a déjà une facture : validation impossible' USING ERRCODE = 'P0001';
  END IF;$x$;
BEGIN
  d := pg_get_functiondef('public.valider_commande(uuid,text,numeric)'::regprocedure); o := d;
  IF position('Commande déjà traitée' in d) > 0 THEN RETURN; END IF; -- déjà appliquée
  d := replace(d, v_ancre, v_ancre || v_garde);
  IF d = o OR position('Commande déjà traitée' in d) = 0 THEN
    RAISE EXCEPTION 'valider_commande : remplacement impossible (ancre introuvable)';
  END IF;
  EXECUTE d;
END $$;
