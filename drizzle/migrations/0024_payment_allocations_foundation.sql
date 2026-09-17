-- ============================================================
-- Payment Allocation : socle unique (tables + RPC + backfill)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payment_allocations (
  allocation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paiement_id uuid NOT NULL REFERENCES public.paiements(paiement_id) ON DELETE CASCADE,
  facture_id uuid NOT NULL REFERENCES public.factures(facture_id) ON DELETE RESTRICT,
  montant numeric NOT NULL CHECK (montant > 0),
  methode text NOT NULL DEFAULT 'auto',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT payment_allocations_unique UNIQUE (paiement_id, facture_id)
);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_paiement ON public.payment_allocations(paiement_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_facture ON public.payment_allocations(facture_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_allocations TO authenticated;
GRANT ALL ON public.payment_allocations TO service_role;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_allocations_read" ON public.payment_allocations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "payment_allocations_write" ON public.payment_allocations
  FOR ALL TO authenticated
  USING (public.can_write_module('paiements')) WITH CHECK (public.can_write_module('paiements'));

CREATE TABLE IF NOT EXISTS public.payment_line_allocations (
  line_allocation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id uuid NOT NULL REFERENCES public.payment_allocations(allocation_id) ON DELETE CASCADE,
  ligne_id uuid NOT NULL,
  produit_id uuid,
  designation text,
  montant numeric NOT NULL DEFAULT 0 CHECK (montant >= 0),
  methode text NOT NULL DEFAULT 'auto',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_line_allocations_unique UNIQUE (allocation_id, ligne_id)
);
CREATE INDEX IF NOT EXISTS idx_pla_allocation ON public.payment_line_allocations(allocation_id);
CREATE INDEX IF NOT EXISTS idx_pla_produit ON public.payment_line_allocations(produit_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_line_allocations TO authenticated;
GRANT ALL ON public.payment_line_allocations TO service_role;
ALTER TABLE public.payment_line_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pla_read" ON public.payment_line_allocations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "pla_write" ON public.payment_line_allocations
  FOR ALL TO authenticated
  USING (public.can_write_module('paiements')) WITH CHECK (public.can_write_module('paiements'));

CREATE TABLE IF NOT EXISTS public.payment_line_allocation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_allocation_id uuid,
  allocation_id uuid,
  produit_id uuid,
  ancien_montant numeric,
  nouveau_montant numeric,
  raison text NOT NULL,
  modifie_par uuid,
  modifie_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plaa_allocation ON public.payment_line_allocation_audit(allocation_id);
GRANT SELECT, INSERT ON public.payment_line_allocation_audit TO authenticated;
GRANT ALL ON public.payment_line_allocation_audit TO service_role;
ALTER TABLE public.payment_line_allocation_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plaa_read" ON public.payment_line_allocation_audit
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- Ventilation produit automatique (plus grand reste, somme exacte)
-- ============================================================
CREATE OR REPLACE FUNCTION public.allocate_payment_to_invoice_lines(_allocation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_alloc public.payment_allocations;
  v_total_lignes numeric;
  v_reste numeric;
  r record;
BEGIN
  SELECT * INTO v_alloc FROM public.payment_allocations WHERE allocation_id = _allocation_id;
  IF v_alloc.allocation_id IS NULL THEN RAISE EXCEPTION 'Allocation introuvable'; END IF;

  -- on ne réécrit jamais une ventilation manuelle
  IF EXISTS (SELECT 1 FROM public.payment_line_allocations
             WHERE allocation_id = _allocation_id AND methode = 'manuelle') THEN
    RETURN;
  END IF;

  DELETE FROM public.payment_line_allocations WHERE allocation_id = _allocation_id;

  SELECT COALESCE(sum(cl.total_ligne), 0) INTO v_total_lignes
  FROM public.factures f
  JOIN public.commande_lignes cl ON cl.commande_id = f.commande_id
  WHERE f.facture_id = v_alloc.facture_id;

  IF v_total_lignes IS NULL OR v_total_lignes <= 0 THEN
    RETURN; -- facture sans lignes : traçabilité produit impossible
  END IF;

  v_reste := v_alloc.montant;

  FOR r IN
    SELECT cl.ligne_id, cl.produit_id, cl.designation, cl.total_ligne,
           round(v_alloc.montant * cl.total_ligne / v_total_lignes, 2) AS part,
           row_number() OVER (ORDER BY cl.total_ligne DESC, cl.ligne_id) AS rn,
           count(*) OVER () AS nb
    FROM public.factures f
    JOIN public.commande_lignes cl ON cl.commande_id = f.commande_id
    WHERE f.facture_id = v_alloc.facture_id
    ORDER BY cl.total_ligne DESC, cl.ligne_id
  LOOP
    INSERT INTO public.payment_line_allocations(allocation_id, ligne_id, produit_id, designation, montant, methode)
    VALUES (
      _allocation_id, r.ligne_id, r.produit_id, r.designation,
      CASE WHEN r.rn = r.nb THEN GREATEST(v_reste, 0) ELSE LEAST(r.part, GREATEST(v_reste, 0)) END,
      'auto'
    );
    v_reste := v_reste - CASE WHEN r.rn = r.nb THEN GREATEST(v_reste, 0) ELSE LEAST(r.part, GREATEST(v_reste, 0)) END;
  END LOOP;
END; $$;

-- ============================================================
-- Recalcul facture depuis les allocations (source unique)
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalc_facture_from_payment_allocations(_facture_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total numeric; v_paye numeric; v_client uuid; v_statut text;
BEGIN
  SELECT montant_total, client_id, statut INTO v_total, v_client, v_statut
  FROM public.factures WHERE facture_id = _facture_id;
  IF v_total IS NULL THEN RETURN; END IF;

  SELECT COALESCE(sum(pa.montant), 0) INTO v_paye
  FROM public.payment_allocations pa
  JOIN public.paiements p ON p.paiement_id = pa.paiement_id
  WHERE pa.facture_id = _facture_id AND p.statut NOT IN ('annule', 'rejete');

  IF v_statut = 'annulee' THEN
    UPDATE public.factures SET montant_paye = v_paye WHERE facture_id = _facture_id;
  ELSE
    UPDATE public.factures SET
      montant_paye = v_paye,
      statut = CASE WHEN v_paye >= v_total THEN 'payee' WHEN v_paye > 0 THEN 'partielle' ELSE 'impayee' END
    WHERE facture_id = _facture_id;
  END IF;

  PERFORM public._recalc_solde_client_internal(v_client);
END; $$;

-- ============================================================
-- Backfill historique : 1 allocation par paiement mono-facture
-- ============================================================
INSERT INTO public.payment_allocations(paiement_id, facture_id, montant, methode, created_at, created_by)
SELECT p.paiement_id, p.facture_id, p.montant, 'auto', p.created_at, p.cree_par
FROM public.paiements p
WHERE p.facture_id IS NOT NULL
  AND p.montant > 0
  AND NOT EXISTS (SELECT 1 FROM public.payment_allocations a WHERE a.paiement_id = p.paiement_id)
ON CONFLICT DO NOTHING;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT allocation_id FROM public.payment_allocations LOOP
    PERFORM public.allocate_payment_to_invoice_lines(r.allocation_id);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.allocate_payment_to_invoice_lines(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalc_facture_from_payment_allocations(uuid) TO authenticated, service_role;
