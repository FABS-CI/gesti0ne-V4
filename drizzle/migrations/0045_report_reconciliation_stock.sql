CREATE OR REPLACE FUNCTION public.report_reconciliation_stock()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v jsonb;
BEGIN
  IF NOT (public.has_permission_v2(auth.uid(),'stock.voir') OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'Permission refusée' USING ERRCODE='42501';
  END IF;
  WITH last_mv AS (
    SELECT DISTINCT ON (produit_id, depot_id) produit_id, depot_id, stock_resultant, created_at, document_reference
    FROM public.stock_mouvements WHERE depot_id IS NOT NULL AND stock_resultant IS NOT NULL
    ORDER BY produit_id, depot_id, created_at DESC
  ), depots_ecarts AS (
    SELECT sd.produit_id, p.reference, p.titre, d.nom depot, sd.quantite stock_enregistre,
           lm.stock_resultant stock_mouvements, sd.quantite - lm.stock_resultant ecart,
           lm.created_at dernier_mouvement, lm.document_reference
    FROM public.stocks_depots sd
    JOIN last_mv lm ON lm.produit_id=sd.produit_id AND lm.depot_id=sd.depot_id
    JOIN public.produits p ON p.produit_id=sd.produit_id
    JOIN public.depots d ON d.depot_id=sd.depot_id
    WHERE sd.quantite <> lm.stock_resultant
  ), produits_ecarts AS (
    SELECT p.produit_id, p.reference, p.titre, p.stock stock_produit, sum(sd.quantite) somme_depots, p.stock - sum(sd.quantite) ecart
    FROM public.produits p JOIN public.stocks_depots sd ON sd.produit_id=p.produit_id
    GROUP BY p.produit_id HAVING p.stock <> sum(sd.quantite)
  )
  SELECT jsonb_build_object(
    'lignes_controlees', (SELECT count(*) FROM public.stocks_depots),
    'sans_mouvement', (SELECT count(*) FROM public.stocks_depots sd WHERE NOT EXISTS (SELECT 1 FROM last_mv lm WHERE lm.produit_id=sd.produit_id AND lm.depot_id=sd.depot_id)),
    'depots', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY abs(x.ecart) DESC) FROM depots_ecarts x),'[]'::jsonb),
    'produits', COALESCE((SELECT jsonb_agg(to_jsonb(y) ORDER BY abs(y.ecart) DESC) FROM produits_ecarts y),'[]'::jsonb)
  ) INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.report_reconciliation_stock() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_reconciliation_stock() TO authenticated;