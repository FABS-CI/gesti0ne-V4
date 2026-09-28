CREATE OR REPLACE FUNCTION public.sec_replace_user_scope(
  _actor_id uuid, _user_id uuid, _role_codes text[], _depot_ids uuid[], _principal uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _actor_id IS NULL OR NOT public.is_global_scope(_actor_id) THEN
    RAISE EXCEPTION 'Accès réservé au Super Administrateur' USING ERRCODE = '42501';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> _actor_id THEN
    RAISE EXCEPTION 'Acteur invalide' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.rbac2_user_roles WHERE user_id = _user_id;
  INSERT INTO public.rbac2_user_roles(user_id, role_code, granted_by)
    SELECT _user_id, c, _actor_id FROM unnest(coalesce(_role_codes, '{}')) AS c GROUP BY c;
  DELETE FROM public.user_depots WHERE user_id = _user_id;
  INSERT INTO public.user_depots(user_id, depot_id, principal)
    SELECT _user_id, d, d = _principal FROM unnest(coalesce(_depot_ids, '{}')) AS d GROUP BY d;
END $$;
REVOKE ALL ON FUNCTION public.sec_replace_user_scope(uuid,uuid,text[],uuid[],uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sec_replace_user_scope(uuid,uuid,text[],uuid[],uuid) TO service_role;