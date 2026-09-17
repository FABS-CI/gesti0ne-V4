-- ============================================================
-- Paiement multi-factures (chemin unique de création)
-- ============================================================
CREATE OR REPLACE FUNCTION public.enregistrer_paiement_multi(_payload jsonb)
RETURNS SETOF public.paiements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid; v_ref text;
  v_montant numeric := COALESCE((_payload->>'montant')::numeric, 0);
  v_date date := COALESCE((_payload->>'date_paiement')::date, current_date);
  v_idem text := NULLIF(_payload->>'idempotency_key','');
  v_existing uuid;
  v_client_id uuid := NULLIF(_payload->>'client_id','')::uuid;
  v_client_nom text;
  v_ex uuid;
  v_sum numeric := 0;
  v_alloc_id uuid;
  v_first_facture uuid;
  r jsonb;
  v_f record;
  v_solde numeric;
  v_nb int;
BEGIN
  PERFORM public.assert_permission('paiements.creer');

  IF v_idem IS NOT NULL THEN
    SELECT paiement_id INTO v_existing FROM public.paiements WHERE idempotency_key = v_idem;
    IF v_existing IS NOT NULL THEN
      RETURN QUERY SELECT * FROM public.paiements WHERE paiement_id = v_existing;
      RETURN;
    END IF;
  END IF;

  IF v_montant <= 0 THEN RAISE EXCEPTION 'Le montant du paiement doit être positif'; END IF;

  SELECT count(*) INTO v_nb FROM jsonb_array_elements(COALESCE(_payload->'allocations','[]'::jsonb));
  IF v_nb = 0 THEN RAISE EXCEPTION 'Aucune facture sélectionnée'; END IF;

  SELECT count(DISTINCT x->>'facture_id') INTO v_nb
    FROM jsonb_array_elements(_payload->'allocations') x;
  IF v_nb <> jsonb_array_length(_payload->'allocations') THEN
    RAISE EXCEPTION 'Une même facture est affectée plusieurs fois';
  END IF;

  -- Contrôles ligne à ligne (verrou sur chaque facture : anti-concurrence)
  FOR r IN SELECT * FROM jsonb_array_elements(_payload->'allocations') LOOP
    SELECT f.facture_id, f.client_id, f.client_nom, f.statut, f.montant_total, COALESCE(f.montant_paye,0) AS paye
      INTO v_f
      FROM public.factures f
      WHERE f.facture_id = NULLIF(r->>'facture_id','')::uuid
      FOR UPDATE;

    IF v_f.facture_id IS NULL THEN RAISE EXCEPTION 'Facture introuvable'; END IF;
    IF v_f.statut = 'annulee' THEN RAISE EXCEPTION 'Facture annulée : affectation impossible'; END IF;

    IF v_client_id IS NULL THEN
      v_client_id := v_f.client_id; v_client_nom := v_f.client_nom;
    ELSIF v_f.client_id IS DISTINCT FROM v_client_id THEN
      RAISE EXCEPTION 'Toutes les factures doivent appartenir au même client';
    END IF;
    IF v_client_nom IS NULL THEN v_client_nom := v_f.client_nom; END IF;

    IF COALESCE((r->>'montant')::numeric, 0) <= 0 THEN
      RAISE EXCEPTION 'Montant affecté invalide pour la facture %', v_f.facture_id;
    END IF;

    v_solde := v_f.montant_total - v_f.paye;
    IF (r->>'montant')::numeric > v_solde + 0.01 THEN
      RAISE EXCEPTION 'Montant affecté supérieur au solde restant de la facture (% FCFA)', v_solde;
    END IF;

    v_sum := v_sum + (r->>'montant')::numeric;
    IF v_first_facture IS NULL THEN v_first_facture := v_f.facture_id; END IF;
  END LOOP;

  IF v_sum > v_montant + 0.01 THEN
    RAISE EXCEPTION 'Le total affecté (%) dépasse le montant du paiement (%)', v_sum, v_montant;
  END IF;

  v_ex := public._resolve_exercice_id(v_date);
  IF v_ex IS NULL THEN
    SELECT exercice_id INTO v_ex FROM public.exercices_comptables WHERE is_actif ORDER BY date_debut DESC LIMIT 1;
  END IF;

  v_ref := public._next_ref('PAI', 'public.paiements', 'reference');

  INSERT INTO public.paiements(
    reference, facture_id, client_nom, date_paiement, montant, mode_paiement,
    statut, notes, reference_paiement, banque, num_transaction, observations,
    cree_par, exercice_id, idempotency_key
  ) VALUES (
    v_ref,
    CASE WHEN jsonb_array_length(_payload->'allocations') = 1 THEN v_first_facture ELSE NULL END,
    v_client_nom, v_date, v_montant, COALESCE(_payload->>'mode_paiement','especes'), 'valide',
    _payload->>'notes', _payload->>'reference_paiement', _payload->>'banque',
    _payload->>'num_transaction', _payload->>'observations', auth.uid(), v_ex, v_idem
  ) RETURNING paiement_id INTO v_id;

  FOR r IN SELECT * FROM jsonb_array_elements(_payload->'allocations') LOOP
    INSERT INTO public.payment_allocations(paiement_id, facture_id, montant, methode, created_by)
    VALUES (v_id, (r->>'facture_id')::uuid, (r->>'montant')::numeric, 'auto', auth.uid())
    RETURNING allocation_id INTO v_alloc_id;
    PERFORM public.allocate_payment_to_invoice_lines(v_alloc_id);
    PERFORM public.recalc_facture_from_payment_allocations((r->>'facture_id')::uuid);
  END LOOP;

  RETURN QUERY SELECT * FROM public.paiements WHERE paiement_id = v_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.enregistrer_paiement_multi(jsonb) TO authenticated, service_role;

-- ============================================================
-- Lecture des allocations d'un paiement (facture + produits)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_payment_allocations(_paiement_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'reference'), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'allocation_id', pa.allocation_id,
      'facture_id', pa.facture_id,
      'reference', f.reference,
      'date_facture', f.date_facture,
      'montant_facture', f.montant_total,
      'montant_affecte', pa.montant,
      'methode', pa.methode,
      'lignes', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'line_allocation_id', pl.line_allocation_id,
          'ligne_id', pl.ligne_id,
          'produit_id', pl.produit_id,
          'designation', COALESCE(pl.designation, cl.designation),
          'reference_produit', cl.reference_produit,
          'total_ligne', cl.total_ligne,
          'montant', pl.montant,
          'methode', pl.methode
        ) ORDER BY pl.montant DESC)
        FROM public.payment_line_allocations pl
        LEFT JOIN public.commande_lignes cl ON cl.ligne_id = pl.ligne_id
        WHERE pl.allocation_id = pa.allocation_id
      ), '[]'::jsonb)
    ) AS x
    FROM public.payment_allocations pa
    JOIN public.factures f ON f.facture_id = pa.facture_id
    WHERE pa.paiement_id = _paiement_id
  ) s;
$$;
GRANT EXECUTE ON FUNCTION public.get_payment_allocations(uuid) TO authenticated, service_role;

-- ============================================================
-- Correction manuelle de la ventilation produit
-- ============================================================
CREATE OR REPLACE FUNCTION public.override_payment_product_allocation(
  _allocation_id uuid, _lignes jsonb, _raison text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_alloc public.payment_allocations;
  v_sum numeric := 0;
  r jsonb;
  v_old numeric;
  v_line_id uuid;
BEGIN
  PERFORM public.assert_permission('paiements.creer');
  IF _raison IS NULL OR btrim(_raison) = '' THEN
    RAISE EXCEPTION 'Raison de la modification obligatoire';
  END IF;

  SELECT * INTO v_alloc FROM public.payment_allocations WHERE allocation_id = _allocation_id FOR UPDATE;
  IF v_alloc.allocation_id IS NULL THEN RAISE EXCEPTION 'Allocation introuvable'; END IF;

  SELECT COALESCE(sum((x->>'montant')::numeric), 0) INTO v_sum
  FROM jsonb_array_elements(COALESCE(_lignes,'[]'::jsonb)) x;

  IF abs(v_sum - v_alloc.montant) > 0.01 THEN
    RAISE EXCEPTION 'Le total ventilé (%) doit être égal au montant affecté (%)', v_sum, v_alloc.montant;
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(_lignes) LOOP
    IF COALESCE((r->>'montant')::numeric, 0) < 0 THEN
      RAISE EXCEPTION 'Montant négatif interdit';
    END IF;
    v_line_id := NULLIF(r->>'ligne_id','')::uuid;

    SELECT montant INTO v_old FROM public.payment_line_allocations
      WHERE allocation_id = _allocation_id AND ligne_id = v_line_id;

    INSERT INTO public.payment_line_allocations(allocation_id, ligne_id, produit_id, designation, montant, methode)
    VALUES (_allocation_id, v_line_id, NULLIF(r->>'produit_id','')::uuid, r->>'designation',
            (r->>'montant')::numeric, 'manuelle')
    ON CONFLICT (allocation_id, ligne_id) DO UPDATE
      SET montant = EXCLUDED.montant, methode = 'manuelle', updated_at = now();

    INSERT INTO public.payment_line_allocation_audit(
      line_allocation_id, allocation_id, produit_id, ancien_montant, nouveau_montant, raison, modifie_par)
    SELECT pl.line_allocation_id, _allocation_id, pl.produit_id, v_old, pl.montant, btrim(_raison), auth.uid()
    FROM public.payment_line_allocations pl
    WHERE pl.allocation_id = _allocation_id AND pl.ligne_id = v_line_id;
  END LOOP;

  UPDATE public.payment_allocations SET methode = 'manuelle' WHERE allocation_id = _allocation_id;

  RETURN public.get_payment_allocations(v_alloc.paiement_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.override_payment_product_allocation(uuid, jsonb, text) TO authenticated, service_role;

-- ============================================================
-- CA encaissé réel par produit (source unique des encaissements)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rapport_produits_encaissement(
  _date_debut date DEFAULT NULL, _date_fin date DEFAULT NULL
)
RETURNS TABLE (
  produit_id uuid,
  reference_produit text,
  designation text,
  ca_encaisse numeric,
  nb_paiements bigint,
  nb_factures bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    pl.produit_id,
    max(cl.reference_produit) AS reference_produit,
    max(COALESCE(pl.designation, cl.designation)) AS designation,
    sum(pl.montant) AS ca_encaisse,
    count(DISTINCT p.paiement_id) AS nb_paiements,
    count(DISTINCT pa.facture_id) AS nb_factures
  FROM public.payment_line_allocations pl
  JOIN public.payment_allocations pa ON pa.allocation_id = pl.allocation_id
  JOIN public.paiements p ON p.paiement_id = pa.paiement_id
  LEFT JOIN public.commande_lignes cl ON cl.ligne_id = pl.ligne_id
  WHERE p.statut NOT IN ('annule','rejete')
    AND (_date_debut IS NULL OR p.date_paiement >= _date_debut)
    AND (_date_fin IS NULL OR p.date_paiement <= _date_fin)
  GROUP BY pl.produit_id
$$;
GRANT EXECUTE ON FUNCTION public.rapport_produits_encaissement(date, date) TO authenticated, service_role;
