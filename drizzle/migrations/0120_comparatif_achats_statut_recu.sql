-- Le comparatif ne comptait pas les achats au statut 'recu' (le statut 'receptionne' n'existe pas).
CREATE OR REPLACE FUNCTION public.exercices_comparatif(_exercice_ids uuid[])
 RETURNS TABLE(exercice_id uuid, libelle text, ca numeric, encaisse numeric, achats numeric, nb_commandes bigint, nb_factures bigint, montant_paye numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_permission(auth.uid(), 'comptabilite.voir') THEN
    RAISE EXCEPTION 'Permission refusée : comptabilite.voir' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    ex.exercice_id,
    ex.libelle,
    COALESCE((SELECT sum(f.montant_total) FROM public.factures f
              WHERE f.exercice_id = ex.exercice_id AND f.statut <> 'annulee'), 0)::numeric,
    COALESCE((SELECT sum(p.montant) FROM public.paiements p
              WHERE p.exercice_id = ex.exercice_id AND p.statut = 'valide'), 0)::numeric,
    COALESCE((SELECT sum(a.montant) FROM public.achats a
              WHERE a.exercice_id = ex.exercice_id
                AND a.statut IN ('recu','receptionne','paye')), 0)::numeric,
    COALESCE((SELECT count(*) FROM public.commandes c WHERE c.exercice_id = ex.exercice_id), 0),
    COALESCE((SELECT count(*) FROM public.factures f
              WHERE f.exercice_id = ex.exercice_id AND f.statut <> 'annulee'), 0),
    COALESCE((SELECT sum(f.montant_paye) FROM public.factures f
              WHERE f.exercice_id = ex.exercice_id AND f.statut <> 'annulee'), 0)::numeric
  FROM public.exercices_comptables ex
  WHERE ex.exercice_id = ANY(_exercice_ids)
  ORDER BY ex.date_debut;
END;
$function$;