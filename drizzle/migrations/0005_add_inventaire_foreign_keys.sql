ALTER TABLE public.inventaires
  ADD CONSTRAINT inventaires_depot_id_fkey FOREIGN KEY (depot_id) REFERENCES public.depots(depot_id);

ALTER TABLE public.inventaire_lignes
  ADD CONSTRAINT inventaire_lignes_produit_id_fkey FOREIGN KEY (produit_id) REFERENCES public.produits(produit_id);

CREATE INDEX IF NOT EXISTS inventaire_lignes_produit_idx ON public.inventaire_lignes(produit_id);
CREATE INDEX IF NOT EXISTS inventaires_depot_idx ON public.inventaires(depot_id);