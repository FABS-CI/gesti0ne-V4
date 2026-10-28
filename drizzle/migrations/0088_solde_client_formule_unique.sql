-- Solde client : une seule formule, identique au relevé client (src/lib/pdf/releve-data.ts).
--
-- Avant : trois calculs s'écrasaient selon la dernière opération
--   * tg_sync_client_solde : toutes les factures non annulées (avoirs négatifs compris) - montant payé ;
--   * _recalc_solde_client_internal / recalculer_solde_client(s) : factures impayées/partielles seulement,
--     retours ignorés (le nouveau circuit ne modifie plus montant_total) ;
--   * retour « diminuer le solde » : décrément direct, effacé au recalcul suivant.
--
-- Désormais :
--   solde = factures (hors annulées et factures d'avoir)
--         - affectations des paiements validés
--         - retours validés financièrement (valide, accepte, valide_compta, cloture)
-- Le retour est compté une seule fois, quelle que soit l'option de traitement (la facture
-- d'avoir éventuelle est exclue des factures, comme dans le relevé).

CREATE OR REPLACE FUNCTION public.solde_client_calcule(_client_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((SELECT sum(f.montant_total) FROM public.factures f
              WHERE f.client_id = _client_id
                AND lower(COALESCE(f.statut, '')) NOT IN ('annule', 'annulee', 'avoir')), 0)
  - COALESCE((SELECT sum(pa.montant) FROM public.payment_allocations pa
              JOIN public.paiements p ON p.paiement_id = pa.paiement_id AND p.statut = 'valide'
              JOIN public.factures f ON f.facture_id = pa.facture_id
              WHERE f.client_id = _client_id), 0)
  - COALESCE((SELECT sum(r.montant) FROM public.retours r
              WHERE r.client_id = _client_id
                AND lower(COALESCE(r.statut, '')) IN ('valide', 'accepte', 'valide_compta', 'cloture')), 0)
$$;
-- Usage interne (triggers, recalculs, audits) : pas d'appel direct depuis le navigateur.
REVOKE ALL ON FUNCTION public.solde_client_calcule(uuid) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.solde_client_calcule(uuid) IS
  'Formule unique du solde client (identique au relevé) : factures - paiements validés affectés - retours validés.';

CREATE OR REPLACE FUNCTION public._recalc_solde_client_internal(_client_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_solde numeric;
BEGIN
  IF _client_id IS NULL THEN RETURN 0; END IF;
  v_solde := public.solde_client_calcule(_client_id);
  UPDATE public.clients SET solde = v_solde, updated_at = now()
   WHERE client_id = _client_id AND solde IS DISTINCT FROM v_solde;
  RETURN v_solde;
END; $$;

CREATE OR REPLACE FUNCTION public.recalculer_solde_client(_client_id uuid, _motif text)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_permission(auth.uid(), 'exercices.modifier') THEN
    RAISE EXCEPTION 'Permission refusée : exercices.modifier' USING ERRCODE = '42501';
  END IF;
  RETURN public._recalc_solde_client_internal(_client_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculer_soldes_global_clients(_motif text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_n int := 0;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'exercices.modifier') THEN
    RAISE EXCEPTION 'Permission refusée : exercices.modifier' USING ERRCODE = '42501';
  END IF;
  WITH upd AS (
    UPDATE public.clients c SET solde = public.solde_client_calcule(c.client_id)
    RETURNING 1
  )
  SELECT count(*) INTO v_n FROM upd;
  RETURN jsonb_build_object('clients_traites', v_n, 'motif', _motif);
END;
$$;

-- Trigger de synchronisation : même formule. Pour un paiement, on recalcule le client
-- de chaque facture affectée (paiements multi-factures sans facture_id).
CREATE OR REPLACE FUNCTION public.tg_sync_client_solde()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  IF TG_TABLE_NAME IN ('factures', 'retours') THEN
    -- Ancien client (modification, suppression) puis nouveau client s'il a changé.
    IF TG_OP <> 'INSERT' THEN PERFORM public._recalc_solde_client_internal(OLD.client_id); END IF;
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.client_id IS DISTINCT FROM OLD.client_id) THEN
      PERFORM public._recalc_solde_client_internal(NEW.client_id);
    END IF;
  ELSIF TG_TABLE_NAME = 'payment_allocations' THEN
    FOR r IN SELECT DISTINCT f.client_id FROM public.factures f
              WHERE f.facture_id IN (
                CASE WHEN TG_OP <> 'INSERT' THEN OLD.facture_id END,
                CASE WHEN TG_OP <> 'DELETE' THEN NEW.facture_id END)
    LOOP
      PERFORM public._recalc_solde_client_internal(r.client_id);
    END LOOP;
  ELSIF TG_TABLE_NAME = 'paiements' THEN
    FOR r IN SELECT DISTINCT f.client_id FROM public.factures f
              WHERE f.facture_id = COALESCE(NEW.facture_id, OLD.facture_id)
                 OR f.facture_id IN (SELECT pa.facture_id FROM public.payment_allocations pa
                                      WHERE pa.paiement_id = COALESCE(NEW.paiement_id, OLD.paiement_id))
    LOOP
      PERFORM public._recalc_solde_client_internal(r.client_id);
    END LOOP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_client_solde_factures ON public.factures;
CREATE TRIGGER trg_sync_client_solde_factures
AFTER INSERT OR UPDATE OF montant_total, montant_paye, statut, client_id OR DELETE
ON public.factures
FOR EACH ROW EXECUTE FUNCTION public.tg_sync_client_solde();

DROP TRIGGER IF EXISTS trg_sync_client_solde_paiements ON public.paiements;
CREATE TRIGGER trg_sync_client_solde_paiements
AFTER INSERT OR UPDATE OF statut, facture_id, montant OR DELETE
ON public.paiements
FOR EACH ROW EXECUTE FUNCTION public.tg_sync_client_solde();

DROP TRIGGER IF EXISTS trg_sync_client_solde_allocations ON public.payment_allocations;
CREATE TRIGGER trg_sync_client_solde_allocations
AFTER INSERT OR UPDATE OF montant, facture_id, paiement_id OR DELETE
ON public.payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.tg_sync_client_solde();

-- Retours : la validation, l'annulation ou un changement de montant met le solde à jour,
-- y compris après le décrément direct de l'option « diminuer le solde ».
DROP TRIGGER IF EXISTS trg_sync_client_solde_retours ON public.retours;
CREATE TRIGGER trg_sync_client_solde_retours
AFTER INSERT OR UPDATE OF statut, montant, client_id OR DELETE
ON public.retours
FOR EACH ROW EXECUTE FUNCTION public.tg_sync_client_solde();

-- Audits : comparent le solde stocké à la même formule.
CREATE OR REPLACE FUNCTION public.audit_compta_soldes_clients()
RETURNS TABLE(client_id uuid, nom text, solde_calcule numeric, solde_stocke numeric, ecart numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_permission(auth.uid(), 'comptabilite.voir') THEN
    RAISE EXCEPTION 'Permission refusée : comptabilite.voir' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT c.client_id, c.nom, calc.solde, COALESCE(c.solde, 0), calc.solde - COALESCE(c.solde, 0)
  FROM public.clients c
  CROSS JOIN LATERAL (SELECT public.solde_client_calcule(c.client_id) AS solde) calc
  WHERE abs(COALESCE(c.solde, 0) - calc.solde) > 0.01
  LIMIT 500;
END; $function$;

CREATE OR REPLACE FUNCTION public.audit_compta_soldes_ecarts()
RETURNS TABLE(
  client_id uuid,
  reference text,
  nom text,
  solde_enregistre numeric,
  solde_calcule numeric,
  ecart numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_permission('audit.voir');
  RETURN QUERY
  SELECT c.client_id,
         COALESCE(c.reference, '—'),
         c.nom,
         COALESCE(c.solde, 0),
         calc.solde,
         COALESCE(c.solde, 0) - calc.solde
  FROM public.clients c
  CROSS JOIN LATERAL (SELECT public.solde_client_calcule(c.client_id) AS solde) calc
  WHERE COALESCE(c.solde, 0) <> calc.solde
  ORDER BY abs(COALESCE(c.solde, 0) - calc.solde) DESC
  LIMIT 200;
END;
$$;

-- Remise à niveau de tous les soldes existants.
UPDATE public.clients c SET solde = public.solde_client_calcule(c.client_id)
 WHERE c.solde IS DISTINCT FROM public.solde_client_calcule(c.client_id);
