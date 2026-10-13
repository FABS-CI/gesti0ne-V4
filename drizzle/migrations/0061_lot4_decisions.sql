ALTER TABLE public.commande_lignes VALIDATE CONSTRAINT ck_commande_lignes_quantite_pos;
ALTER TABLE public.commande_lignes VALIDATE CONSTRAINT ck_commande_lignes_prix_pos;
ALTER TABLE public.commande_lignes VALIDATE CONSTRAINT ck_commande_lignes_remise_pct;
ALTER TABLE public.retour_lignes VALIDATE CONSTRAINT retour_lignes_quantite_positive;

ALTER TABLE public.commandes ADD CONSTRAINT ck_commandes_sans_tva
  CHECK (coalesce(taux_tva,0) = 0 AND coalesce(montant_tva,0) = 0);

CREATE OR REPLACE FUNCTION public.trg_block_delete_facture_certifiee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.document_certifications
             WHERE document_type = 'FACTURE' AND document_id::text = OLD.id::text) THEN
    RAISE EXCEPTION 'Suppression interdite : la facture % est certifiée. Annulez-la ou émettez un avoir.', OLD.reference USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.fne_factures
             WHERE facture_id::text = OLD.id::text AND statut IN ('accepted','signed','certified')) THEN
    RAISE EXCEPTION 'Suppression interdite : la facture % est signée DGI. Émettez un avoir.', OLD.reference USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS block_delete_facture_certifiee ON public.factures;
CREATE TRIGGER block_delete_facture_certifiee BEFORE DELETE ON public.factures
  FOR EACH ROW EXECUTE FUNCTION public.trg_block_delete_facture_certifiee();