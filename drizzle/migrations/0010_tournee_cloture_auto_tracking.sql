CREATE OR REPLACE FUNCTION public.livsuivi_confirmer_reception(_id uuid, _signature_url text DEFAULT NULL::text, _photo_url text DEFAULT NULL::text, _receptionnaire_nom text DEFAULT NULL::text, _receptionnaire_tel text DEFAULT NULL::text, _commentaire text DEFAULT NULL::text)
 RETURNS livsuivi_commandes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_row public.livsuivi_commandes; v_tournee uuid; v_reste int;
BEGIN
  PERFORM public.assert_permission('livraisons.changer_statut');

  UPDATE public.livsuivi_commandes
     SET statut = 'reception_confirmee', cloturee = true, derniere_maj = now(),
         signature_url = COALESCE(_signature_url, signature_url),
         photo_preuve_url = COALESCE(_photo_url, photo_preuve_url),
         receptionnaire_nom = COALESCE(_receptionnaire_nom, receptionnaire_nom),
         receptionnaire_telephone = COALESCE(_receptionnaire_tel, receptionnaire_telephone),
         commentaire_reception = COALESCE(_commentaire, commentaire_reception),
         heure_livraison = COALESCE(heure_livraison, now())
   WHERE id = _id
   RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Livraison introuvable'; END IF;

  INSERT INTO public.livsuivi_historique(livraison_id, etape, commentaire, meta, user_id)
  VALUES (_id, 'reception_confirmee', _commentaire,
    jsonb_build_object('receptionnaire', _receptionnaire_nom, 'telephone', _receptionnaire_tel),
    auth.uid());

  v_tournee := v_row.tournee_id;
  IF v_tournee IS NOT NULL THEN
    SELECT count(*) INTO v_reste FROM public.livsuivi_commandes
     WHERE tournee_id = v_tournee AND NOT cloturee;
    IF v_reste = 0 THEN
      UPDATE public.tournees
         SET statut = 'terminee',
             cloture_mode = COALESCE(cloture_mode, 'auto'),
             cloture_at = COALESCE(cloture_at, now()),
             updated_at = now()
       WHERE tournee_id = v_tournee;
    END IF;
  END IF;
  RETURN v_row;
END;$function$;
