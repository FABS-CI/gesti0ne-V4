-- Lot 1 sécurité : un compte suspendu/verrouillé et un rôle archivé ne donnent plus aucun droit SQL ;
-- les champs administratifs du profil ne sont modifiables que par un administrateur.

CREATE OR REPLACE FUNCTION public.account_is_active(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT _user_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.profiles WHERE id = _user_id AND statut = 'actif' AND actif IS TRUE); $$;
REVOKE ALL ON FUNCTION public.account_is_active(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_is_active(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rbac3_has_code(_user_id uuid, _code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND _code IS NOT NULL AND public.account_is_active(_user_id) AND (
    _code IN ('profil.voir', 'notifications.voir')
    OR EXISTS (
      SELECT 1 FROM public.rbac3_user_roles ur
      JOIN public.rbac3_roles r ON r.code = ur.role_code AND r.statut = 'actif'
      WHERE ur.user_id = _user_id AND (
        ur.role_code = 'super_admin'
        OR EXISTS (
          SELECT 1 FROM public.rbac3_role_permissions rp
          WHERE rp.role_code = ur.role_code
            AND (rp.perm_code = _code
                 OR rp.perm_code IN (SELECT c.v3_code FROM public.rbac3_compat c WHERE c.v2_code = _code))
        )
      )
    )
  );
$$;

CREATE OR REPLACE VIEW public.rbac3_user_permissions WITH (security_invoker = on) AS
  SELECT DISTINCT ur.user_id, rp.perm_code AS permission_code
  FROM public.rbac3_user_roles ur
  JOIN public.rbac3_roles r ON r.code = ur.role_code AND r.statut = 'actif'
  JOIN public.rbac3_role_permissions rp ON rp.role_code = ur.role_code
  WHERE public.account_is_active(ur.user_id);
REVOKE ALL ON public.rbac3_user_permissions FROM anon;

CREATE OR REPLACE FUNCTION public.rbac3_can(_perm text, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL OR NOT public.account_is_active(_user_id) THEN RETURN false; END IF;
  IF EXISTS (
    SELECT 1 FROM public.rbac3_user_roles ur
    JOIN public.rbac3_roles r ON r.code = ur.role_code AND r.statut = 'actif'
    WHERE ur.user_id = _user_id AND ur.role_code = 'super_admin'
  ) THEN RETURN true; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.rbac3_user_permissions
    WHERE user_id = _user_id AND permission_code = _perm
  );
END; $$;

CREATE OR REPLACE FUNCTION public.is_global_scope(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.account_is_active(_user_id) AND (
    EXISTS (SELECT 1 FROM public.rbac2_user_roles WHERE user_id = _user_id AND role_code = 'super_admin')
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin'::app_role)
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role_compat(_user_id uuid, _role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.account_is_active(_user_id) AND EXISTS (
    SELECT 1 FROM public.rbac2_user_roles ur
    JOIN public.rbac2_roles r ON r.code = ur.role_code
    WHERE ur.user_id = _user_id AND ur.role_code = _role
      AND coalesce(r.statut, 'actif') NOT IN ('archive', 'inactif')
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.account_is_active(_user_id) AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.profiles_protect_access_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.rbac3_can('administration.modifier') AND (
       NEW.id IS DISTINCT FROM OLD.id
    OR NEW.email IS DISTINCT FROM OLD.email
    OR NEW.statut IS DISTINCT FROM OLD.statut
    OR NEW.actif IS DISTINCT FROM OLD.actif
    OR NEW.locked_at IS DISTINCT FROM OLD.locked_at
    OR NEW.locked_reason IS DISTINCT FROM OLD.locked_reason
    OR NEW.service_id IS DISTINCT FROM OLD.service_id
    OR NEW.departement_id IS DISTINCT FROM OLD.departement_id
    OR NEW.depot_principal_id IS DISTINCT FROM OLD.depot_principal_id
    OR NEW.route_restrictions IS DISTINCT FROM OLD.route_restrictions
    OR NEW.must_change_password IS DISTINCT FROM OLD.must_change_password
    OR NEW.password_compromised_at IS DISTINCT FROM OLD.password_compromised_at
  ) THEN
    RAISE EXCEPTION 'Champs administratifs du profil protégés' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.profiles_protect_access_fields() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE TRIGGER trg_profiles_access_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_protect_access_fields();

ALTER VIEW public.paie_parametres SET (security_invoker = on);
ALTER VIEW public.paie_rubriques SET (security_invoker = on);
REVOKE ALL ON public.paie_parametres, public.paie_rubriques FROM anon;