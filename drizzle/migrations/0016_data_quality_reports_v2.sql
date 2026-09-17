-- Rapports qualité des données alignés sur l'écran d'administration
CREATE OR REPLACE FUNCTION public.report_client_duplicates_v2()
RETURNS TABLE(nom_normalise text, nb bigint, client_ids uuid[], noms text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(btrim(regexp_replace(coalesce(c.nom, ''), '\s+', ' ', 'g'))) AS nom_normalise,
         count(*)::bigint AS nb,
         array_agg(c.client_id ORDER BY c.created_at) AS client_ids,
         array_agg(c.nom ORDER BY c.created_at) AS noms
  FROM public.clients c
  WHERE coalesce(btrim(c.nom), '') <> ''
  GROUP BY 1
  HAVING count(*) > 1
  ORDER BY count(*) DESC, 1;
$$;

CREATE OR REPLACE FUNCTION public.report_bl_orphelins_v2()
RETURNS TABLE(bl_id uuid, reference text, statut text, client_id uuid, montant numeric, cree_le timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.bl_id, b.reference, b.statut, b.client_id, b.montant, b.created_at
  FROM public.bons_livraison b
  WHERE b.commande_id IS NULL
  ORDER BY b.created_at DESC
  LIMIT 200;
$$;

CREATE OR REPLACE FUNCTION public.report_stock_ecarts_v2()
RETURNS TABLE(produit_id uuid, titre text, stock_actuel numeric, stock_calcule numeric, ecart numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.produit_id,
         p.titre,
         coalesce(p.stock, 0)::numeric AS stock_actuel,
         coalesce(m.calcule, 0)::numeric AS stock_calcule,
         (coalesce(p.stock, 0) - coalesce(m.calcule, 0))::numeric AS ecart
  FROM public.produits p
  LEFT JOIN (
    SELECT sm.produit_id,
           sum(coalesce(sm.quantite_entree, 0) - coalesce(sm.quantite_sortie, 0)) AS calcule
    FROM public.stock_mouvements sm
    GROUP BY sm.produit_id
  ) m ON m.produit_id = p.produit_id
  WHERE coalesce(p.stock, 0) <> coalesce(m.calcule, 0)
  ORDER BY abs(coalesce(p.stock, 0) - coalesce(m.calcule, 0)) DESC
  LIMIT 200;
$$;

-- Fusion de clients en doublon (réservée aux super-admins)
CREATE OR REPLACE FUNCTION public.merge_clients(_keep_id uuid, _dup_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res jsonb := '{}'::jsonb;
  v_ids uuid[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Fusion réservée aux super-administrateurs';
  END IF;
  IF _keep_id IS NULL OR _dup_ids IS NULL OR array_length(_dup_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Paramètres de fusion invalides';
  END IF;
  v_ids := array_remove(_dup_ids, _keep_id);
  IF array_length(v_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Aucun doublon à fusionner';
  END IF;

  UPDATE public.commandes SET client_id = _keep_id WHERE client_id = ANY(v_ids);
  UPDATE public.factures SET client_id = _keep_id WHERE client_id = ANY(v_ids);
  UPDATE public.proformas SET client_id = _keep_id WHERE client_id = ANY(v_ids);
  UPDATE public.bons_livraison SET client_id = _keep_id WHERE client_id = ANY(v_ids);
  UPDATE public.livraisons SET client_id = _keep_id WHERE client_id = ANY(v_ids);
  UPDATE public.retours SET client_id = _keep_id WHERE client_id = ANY(v_ids);
  UPDATE public.specimens SET client_id = _keep_id WHERE client_id = ANY(v_ids);
  UPDATE public.crm_interactions SET client_id = _keep_id WHERE client_id = ANY(v_ids);
  DELETE FROM public.soldes_ouverture_clients WHERE client_id = ANY(v_ids);

  DELETE FROM public.clients WHERE client_id = ANY(v_ids);

  v_res := jsonb_build_object('conserve', _keep_id, 'fusionnes', to_jsonb(v_ids));
  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_client_duplicates_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_bl_orphelins_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_stock_ecarts_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_clients(uuid, uuid[]) TO authenticated;