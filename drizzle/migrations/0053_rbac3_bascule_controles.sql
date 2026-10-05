-- Lot D : les contrôles serveur historiques (has_permission, has_permission_v2, assert_permission)
-- lisent désormais RBAC3, source de vérité. Les anciennes versions sont conservées (_legacy) pour retour arrière.

CREATE TABLE IF NOT EXISTS public.rbac3_compat (
  v2_code text NOT NULL,
  v3_code text NOT NULL,
  PRIMARY KEY (v2_code, v3_code)
);
GRANT SELECT ON public.rbac3_compat TO authenticated;
GRANT ALL ON public.rbac3_compat TO service_role;
ALTER TABLE public.rbac3_compat ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rbac3_compat_lecture ON public.rbac3_compat;
CREATE POLICY rbac3_compat_lecture ON public.rbac3_compat FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
INSERT INTO public.rbac3_compat (v2_code, v3_code)
SELECT DISTINCT v2_code, v3_code FROM public.rbac3_compat_map()
ON CONFLICT DO NOTHING;
COMMENT ON TABLE public.rbac3_compat IS 'Correspondance codes historiques -> RBAC3, matérialisée depuis rbac3_compat_map().';

CREATE OR REPLACE FUNCTION public.has_permission_v2_legacy(_user_id uuid, _perm_code text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_has boolean; v_denied boolean;
BEGIN
  IF _user_id IS NULL OR _perm_code IS NULL THEN RETURN false; END IF;
  WITH RECURSIVE role_closure AS (
    SELECT role_code FROM public.rbac2_user_roles WHERE user_id = _user_id
    UNION
    SELECT p.parent_code FROM role_closure rc JOIN public.rbac2_role_parents p ON p.role_code = rc.role_code
  ),
  denials AS (SELECT 1 FROM public.rbac2_role_perms rp JOIN role_closure rc ON rc.role_code = rp.role_code WHERE rp.perm_code = _perm_code AND rp.granted = false),
  grants_ AS (SELECT 1 FROM public.rbac2_role_perms rp JOIN role_closure rc ON rc.role_code = rp.role_code WHERE rp.perm_code = _perm_code AND rp.granted = true)
  SELECT EXISTS (SELECT 1 FROM denials), EXISTS (SELECT 1 FROM grants_) INTO v_denied, v_has;
  IF v_denied THEN RETURN false; END IF;
  RETURN COALESCE(v_has, false);
END; $function$;
COMMENT ON FUNCTION public.has_permission_v2_legacy(uuid, text) IS 'DEPRECATED: ancienne vérification RBAC2, conservée pour retour arrière.';

CREATE OR REPLACE FUNCTION public.has_permission_legacy(_user_id uuid, _permission_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user_id AND ur.role = 'super_admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.rbac_user_roles ur JOIN public.rbac_roles r ON r.role_id = ur.role_id WHERE ur.user_id = _user_id AND r.code = 'super_admin' AND r.actif)
    OR EXISTS (SELECT 1 FROM public.rbac_user_roles ur JOIN public.rbac_roles r ON r.role_id = ur.role_id AND r.actif
      JOIN LATERAL public.rbac_role_ancestors(r.role_id) anc ON true
      JOIN public.rbac_role_permissions rp ON rp.role_id = anc.role_id AND rp.permission_code = _permission_code
      WHERE ur.user_id = _user_id AND rp.accorde = true)
    OR EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.rbac_roles r ON r.code = ur.role::text AND r.actif
      JOIN LATERAL public.rbac_role_ancestors(r.role_id) anc ON true
      JOIN public.rbac_role_permissions rp ON rp.role_id = anc.role_id AND rp.permission_code = _permission_code
      WHERE ur.user_id = _user_id AND rp.accorde = true);
$function$;
COMMENT ON FUNCTION public.has_permission_legacy(uuid, text) IS 'DEPRECATED: ancienne vérification RBAC v1, conservée pour retour arrière.';
REVOKE ALL ON FUNCTION public.has_permission_v2_legacy(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.has_permission_legacy(uuid, text) FROM anon;

CREATE OR REPLACE FUNCTION public.rbac3_has_code(_user_id uuid, _code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT _user_id IS NOT NULL AND _code IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.rbac3_user_roles WHERE user_id = _user_id AND role_code = 'super_admin')
    OR _code IN ('profil.voir', 'notifications.voir')
    OR EXISTS (
      SELECT 1 FROM public.rbac3_user_roles ur
      JOIN public.rbac3_role_permissions rp ON rp.role_code = ur.role_code
      WHERE ur.user_id = _user_id
        AND (rp.perm_code = _code
             OR rp.perm_code IN (SELECT c.v3_code FROM public.rbac3_compat c WHERE c.v2_code = _code))
    )
  );
$function$;
REVOKE ALL ON FUNCTION public.rbac3_has_code(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.rbac3_has_code(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_permission_v2(_user_id uuid, _perm_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT public.rbac3_has_code(_user_id, _perm_code);
$function$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT public.rbac3_has_code(_user_id, _permission_code);
$function$;