ALTER TABLE public.retours ADD COLUMN IF NOT EXISTS remise_globale_pct numeric NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.retours.remise_globale_pct IS 'Remise globale reprise de la commande de la facture d''origine à la création du retour';

CREATE OR REPLACE FUNCTION public._retour_set_remise_globale()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.facture_id IS NOT NULL THEN
    SELECT LEAST(GREATEST(COALESCE(c.remise_globale_pct,0),0),100) INTO NEW.remise_globale_pct
    FROM public.factures f JOIN public.commandes c ON c.commande_id = f.commande_id
    WHERE f.facture_id = NEW.facture_id;
  END IF;
  NEW.remise_globale_pct := COALESCE(NEW.remise_globale_pct, 0);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_retour_set_remise_globale ON public.retours;
CREATE TRIGGER trg_retour_set_remise_globale BEFORE INSERT ON public.retours
FOR EACH ROW EXECUTE FUNCTION public._retour_set_remise_globale();

CREATE OR REPLACE FUNCTION public._retour_recalc_totaux()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE v_id uuid;
BEGIN
  v_id := COALESCE(NEW.retour_id, OLD.retour_id);
  UPDATE public.retours r SET
    nb_produits    = agg.nb,
    total_quantite = agg.qte,
    montant        = agg.montant - ROUND(agg.montant * COALESCE(r.remise_globale_pct,0) / 100.0),
    updated_at     = now()
  FROM (
    SELECT COUNT(*)::int AS nb,
           COALESCE(SUM(COALESCE(quantite_recue, quantite, 0)),0) AS qte,
           COALESCE(SUM(total_ligne),0) AS montant
    FROM public.retour_lignes WHERE retour_id = v_id
  ) agg
  WHERE r.retour_id = v_id;
  RETURN NULL;
END; $function$;

CREATE OR REPLACE FUNCTION public._retour_recalc_totaux(p_retour_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  UPDATE public.retours r SET
    nb_produits    = agg.nb,
    total_quantite = agg.qte,
    montant        = agg.montant - ROUND(agg.montant * COALESCE(r.remise_globale_pct,0) / 100.0),
    updated_at     = now()
  FROM (
    SELECT COUNT(*)::int AS nb,
           COALESCE(SUM(COALESCE(quantite_recue, quantite, 0)),0) AS qte,
           COALESCE(SUM(total_ligne),0) AS montant
    FROM public.retour_lignes WHERE retour_id = p_retour_id
  ) agg
  WHERE r.retour_id = p_retour_id;
END; $function$;