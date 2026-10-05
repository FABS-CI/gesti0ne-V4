-- Audit fichier-56 (§4) : RBAC3 est la référence (interface et RLS).
-- Les policies posées aux lots A/B utilisaient has_permission_v2 (RBAC2) :
-- réalignement sur rbac3_can, comme les autres tables métier.

-- fournisseurs
DROP POLICY IF EXISTS fournisseurs_read_perm ON public.fournisseurs;
DROP POLICY IF EXISTS fournisseurs_insert_perm ON public.fournisseurs;
DROP POLICY IF EXISTS fournisseurs_update_perm ON public.fournisseurs;
DROP POLICY IF EXISTS fournisseurs_delete_perm ON public.fournisseurs;
CREATE POLICY fournisseurs_read_rbac3 ON public.fournisseurs FOR SELECT TO authenticated
  USING (public.rbac3_can('fournisseurs.lire') OR public.rbac3_can('achats.lire'));
CREATE POLICY fournisseurs_insert_rbac3 ON public.fournisseurs FOR INSERT TO authenticated
  WITH CHECK (public.rbac3_can('fournisseurs.creer'));
CREATE POLICY fournisseurs_update_rbac3 ON public.fournisseurs FOR UPDATE TO authenticated
  USING (public.rbac3_can('fournisseurs.modifier'))
  WITH CHECK (public.rbac3_can('fournisseurs.modifier'));
CREATE POLICY fournisseurs_delete_rbac3 ON public.fournisseurs FOR DELETE TO authenticated
  USING (public.rbac3_can('fournisseurs.supprimer'));

-- fne_logs : mêmes droits que l'écriture des factures FNE.
DROP POLICY IF EXISTS fne_logs_insert_perm ON public.fne_logs;
CREATE POLICY fne_logs_insert_rbac3 ON public.fne_logs FOR INSERT TO authenticated
  WITH CHECK (public.rbac3_can('factures.modifier'));