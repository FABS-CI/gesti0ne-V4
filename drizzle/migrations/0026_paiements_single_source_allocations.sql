-- enregistrer_paiement (mono-facture, compatibilité historique) :
-- crée désormais l'allocation et délègue le recalcul aux allocations.
CREATE OR REPLACE FUNCTION public.enregistrer_paiement(_payload jsonb)
RETURNS SETOF public.paiements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_ref text;
  v_facture_id uuid := NULLIF(_payload->>'facture_id','')::uuid;
  v_montant numeric := COALESCE((_payload->>'montant')::numeric, 0);
  v_client_id uuid;
  v_client_nom text;
  v_total numeric; v_paye numeric;
  v_date date := COALESCE((_payload->>'date_paiement')::date, current_date);
  v_ex uuid;
  v_idem text := NULLIF(_payload->>'idempotency_key','');
  v_existing uuid;
  v_statut text;
  v_alloc_id uuid;
BEGIN
  PERFORM public.assert_permission('paiements.creer');

  IF v_idem IS NOT NULL THEN
    SELECT paiement_id INTO v_existing FROM public.paiements WHERE idempotency_key = v_idem;
    IF v_existing IS NOT NULL THEN
      RETURN QUERY SELECT * FROM public.paiements WHERE paiement_id = v_existing;
      RETURN;
    END IF;
  END IF;

  IF v_facture_id IS NULL THEN RAISE EXCEPTION 'facture_id obligatoire'; END IF;
  IF v_montant <= 0 THEN RAISE EXCEPTION 'Le montant du paiement doit être positif'; END IF;

  SELECT client_id, client_nom, montant_total, COALESCE(montant_paye,0), statut
    INTO v_client_id, v_client_nom, v_total, v_paye, v_statut
    FROM public.factures WHERE facture_id = v_facture_id FOR UPDATE;
  IF v_total IS NULL THEN RAISE EXCEPTION 'Facture introuvable'; END IF;
  IF v_statut = 'annulee' THEN RAISE EXCEPTION 'Facture annulée : paiement impossible'; END IF;
  IF v_montant > (v_total - v_paye) + 0.01 THEN
    RAISE EXCEPTION 'Montant supérieur au solde restant de la facture (% FCFA)', (v_total - v_paye);
  END IF;

  v_ex := public._resolve_exercice_id(v_date);
  IF v_ex IS NULL THEN
    SELECT exercice_id INTO v_ex FROM public.exercices_comptables WHERE is_actif ORDER BY date_debut DESC LIMIT 1;
  END IF;

  v_ref := public._next_ref('PAI', 'public.paiements', 'reference');

  INSERT INTO public.paiements(
    reference, facture_id, client_nom, date_paiement, montant, mode_paiement,
    statut, notes, reference_paiement, banque, num_transaction, observations, cree_par, exercice_id,
    idempotency_key
  ) VALUES (
    v_ref, v_facture_id, v_client_nom, v_date, v_montant,
    COALESCE(_payload->>'mode_paiement','especes'), 'valide',
    _payload->>'notes', _payload->>'reference_paiement', _payload->>'banque',
    _payload->>'num_transaction', _payload->>'observations', auth.uid(), v_ex,
    v_idem
  ) RETURNING paiement_id INTO v_id;

  INSERT INTO public.payment_allocations(paiement_id, facture_id, montant, methode, created_by)
  VALUES (v_id, v_facture_id, v_montant, 'auto', auth.uid())
  RETURNING allocation_id INTO v_alloc_id;
  PERFORM public.allocate_payment_to_invoice_lines(v_alloc_id);
  PERFORM public.recalc_facture_from_payment_allocations(v_facture_id);

  RETURN QUERY SELECT * FROM public.paiements WHERE paiement_id = v_id;
END; $$;

-- annuler_paiement : recalcule toutes les factures affectées depuis les allocations
CREATE OR REPLACE FUNCTION public.annuler_paiement(_paiement_id uuid, _raison text, _notes text DEFAULT NULL::text)
RETURNS SETOF public.paiements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.paiements;
  r record;
BEGIN
  PERFORM public.assert_permission('paiements.annuler');

  SELECT * INTO v_row FROM public.paiements WHERE paiement_id = _paiement_id;
  IF v_row.paiement_id IS NULL THEN RAISE EXCEPTION 'Paiement introuvable'; END IF;
  IF v_row.statut = 'annule' THEN RAISE EXCEPTION 'Déjà annulé'; END IF;

  INSERT INTO public.paiement_annulations_audit(paiement_id, facture_id, annule_par, raison, notes, montant_annule)
  VALUES (_paiement_id, v_row.facture_id, auth.uid(), COALESCE(_raison,''), _notes, v_row.montant);

  UPDATE public.paiements SET statut = 'annule' WHERE paiement_id = _paiement_id;

  FOR r IN SELECT DISTINCT facture_id FROM public.payment_allocations WHERE paiement_id = _paiement_id LOOP
    PERFORM public.recalc_facture_from_payment_allocations(r.facture_id);
  END LOOP;

  -- paiement historique sans allocation
  IF NOT EXISTS (SELECT 1 FROM public.payment_allocations WHERE paiement_id = _paiement_id)
     AND v_row.facture_id IS NOT NULL THEN
    PERFORM public.recalc_facture_from_payment_allocations(v_row.facture_id);
  END IF;

  RETURN QUERY SELECT * FROM public.paiements WHERE paiement_id = _paiement_id;
END; $$;
