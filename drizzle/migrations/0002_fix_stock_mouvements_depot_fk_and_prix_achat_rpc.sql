-- FK manquante : stock_mouvements.depot_id -> depots (aucune ligne orpheline)
ALTER TABLE public.stock_mouvements
  ADD CONSTRAINT stock_mouvements_depot_id_fkey
  FOREIGN KEY (depot_id) REFERENCES public.depots(depot_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS stock_mouvements_depot_id_idx ON public.stock_mouvements (depot_id);

-- RPC manquante utilisée par la liste des produits
CREATE OR REPLACE FUNCTION public.get_derniers_prix_achat(_produit_ids UUID[])
RETURNS TABLE (
  produit_id UUID,
  prix_unitaire NUMERIC,
  date_achat DATE,
  achat_id UUID,
  reference TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (al.produit_id)
    al.produit_id,
    al.prix_unitaire,
    a.date_achat,
    a.achat_id,
    a.reference
  FROM public.achat_lignes al
  JOIN public.achats a ON a.achat_id = al.achat_id
  WHERE al.produit_id = ANY(_produit_ids)
  ORDER BY al.produit_id, a.date_achat DESC NULLS LAST, al.created_at DESC
$$;

GRANT EXECUTE ON FUNCTION public.get_derniers_prix_achat(UUID[]) TO authenticated;