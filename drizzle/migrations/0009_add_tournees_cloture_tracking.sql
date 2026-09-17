-- Traçabilité de la clôture des tournées (colonnes attendues par l'application)
ALTER TABLE public.tournees
  ADD COLUMN IF NOT EXISTS cloture_mode text,
  ADD COLUMN IF NOT EXISTS cloture_at timestamptz,
  ADD COLUMN IF NOT EXISTS cloture_by uuid;

-- Clôture manuelle : renseigne le mode, la date et l'auteur
CREATE OR REPLACE FUNCTION public.cloturer_tournee(_tournee_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_total numeric; v_statut text;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'tournees.cloturer') THEN
    RAISE EXCEPTION 'Acces refuse : permission tournees.cloturer requise' USING ERRCODE = '42501';
  END IF;
  PERFORM public.finaliser_tournee_interne(_tournee_id);
  UPDATE public.tournees
     SET statut = 'terminee',
         cloture_mode = COALESCE(cloture_mode, 'manuelle'),
         cloture_at = COALESCE(cloture_at, now()),
         cloture_by = COALESCE(cloture_by, auth.uid()),
         updated_at = now()
   WHERE tournee_id = _tournee_id;
  SELECT COALESCE(cout_total,0), validation_statut INTO v_total, v_statut FROM public.tournees WHERE tournee_id = _tournee_id;
  IF v_total > 0 AND (v_statut IS NULL OR v_statut IN ('brouillon')) THEN
    UPDATE public.tournees SET validation_statut = 'en_attente', updated_at = now() WHERE tournee_id = _tournee_id;
    INSERT INTO public.couts_logistiques_audit(tournee_id, action, actor_id, actor_email, commentaire)
    VALUES (_tournee_id, 'soumission_auto', auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()), 'Soumission automatique a la cloture de la tournee');
  END IF;
END;
$function$;
