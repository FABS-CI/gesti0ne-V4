-- Anti-surpaiement : le contrôle compte aussi les paiements en attente (montant « engagé »).
--
-- Avant : enregistrer_paiement(_multi) comparait le montant au reste à payer calculé avec
-- montant_paye, qui ne compte que les paiements validés (0057). Deux paiements en attente,
-- chacun pour la totalité de la facture, étaient acceptés ; valider_paiement ne refaisait
-- aucun contrôle : la facture était payée deux fois.
--
-- Désormais, au niveau de la base (tous chemins, y compris l'écriture directe d'une affectation) :
--   * une affectation est refusée si l'engagé de la facture (paiements validés + en attente)
--     dépasse son total ;
--   * la validation d'un paiement est refusée si elle ferait dépasser l'encaissé validé
--     (cas des doublons déjà en attente avant cette migration).

CREATE OR REPLACE FUNCTION public.facture_engage(_facture_id uuid, _sauf_allocation uuid DEFAULT NULL)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(sum(pa.montant), 0)
  FROM public.payment_allocations pa
  JOIN public.paiements p ON p.paiement_id = pa.paiement_id
  WHERE pa.facture_id = _facture_id
    AND p.statut IN ('valide', 'en_attente', 'en_attente_validation')
    AND pa.allocation_id IS DISTINCT FROM _sauf_allocation
$$;
COMMENT ON FUNCTION public.facture_engage(uuid, uuid) IS
  'Engagé = affectations des paiements validés ou en attente. Sert à l''anti-surpaiement ; l''encaissé reste facture_encaisse (validés seulement).';

CREATE OR REPLACE FUNCTION public.tg_allocation_anti_surpaiement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_total numeric; v_statut text; v_engage numeric; v_pstatut text;
BEGIN
  SELECT statut INTO v_pstatut FROM public.paiements WHERE paiement_id = NEW.paiement_id;
  IF v_pstatut NOT IN ('valide', 'en_attente', 'en_attente_validation') THEN RETURN NEW; END IF;

  -- Verrou sur la facture : deux affectations simultanées ne peuvent pas passer toutes les deux.
  SELECT montant_total, statut INTO v_total, v_statut
    FROM public.factures WHERE facture_id = NEW.facture_id FOR UPDATE;
  -- Factures d'avoir (montant négatif) : imputations et remboursements hors de ce contrôle.
  IF v_total IS NULL OR v_total < 0 OR v_statut = 'avoir' THEN RETURN NEW; END IF;

  v_engage := public.facture_engage(NEW.facture_id, NEW.allocation_id);
  IF v_engage + NEW.montant > v_total + 0.01 THEN
    RAISE EXCEPTION 'Montant supérieur au reste à payer de la facture (% FCFA, paiements en attente compris)',
      GREATEST(v_total - v_engage, 0)
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_allocation_anti_surpaiement ON public.payment_allocations;
CREATE TRIGGER trg_allocation_anti_surpaiement
BEFORE INSERT OR UPDATE OF montant, facture_id, paiement_id
ON public.payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.tg_allocation_anti_surpaiement();

-- Validation (ou retour au statut validé) : jamais plus d'encaissé que le total de la facture.
CREATE OR REPLACE FUNCTION public.tg_paiement_validation_anti_surpaiement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  IF NEW.statut <> 'valide' OR OLD.statut = 'valide' THEN RETURN NEW; END IF;
  FOR r IN
    SELECT f.facture_id, f.reference, f.montant_total, pa.montant
      FROM public.payment_allocations pa
      JOIN public.factures f ON f.facture_id = pa.facture_id
     WHERE pa.paiement_id = NEW.paiement_id
       AND f.montant_total >= 0 AND COALESCE(f.statut, '') <> 'avoir'
     ORDER BY f.facture_id
       FOR UPDATE OF f
  LOOP
    IF public.facture_encaisse(r.facture_id) + r.montant > r.montant_total + 0.01 THEN
      RAISE EXCEPTION 'Validation refusée : la facture % serait payée au-delà de son total (déjà encaissé % FCFA sur %)',
        r.reference, public.facture_encaisse(r.facture_id), r.montant_total
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_paiement_validation_anti_surpaiement ON public.paiements;
CREATE TRIGGER trg_paiement_validation_anti_surpaiement
BEFORE UPDATE OF statut ON public.paiements
FOR EACH ROW EXECUTE FUNCTION public.tg_paiement_validation_anti_surpaiement();
