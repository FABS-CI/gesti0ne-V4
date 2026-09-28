CREATE OR REPLACE FUNCTION public.report_reconciliation_finance()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(),'super_admin') OR public.is_staff(auth.uid())) THEN
    RAISE EXCEPTION 'Permission refusée' USING ERRCODE='42501';
  END IF;
  WITH alloc AS (
    SELECT a.facture_id, sum(a.montant) paye FROM public.payment_allocations a
    JOIN public.paiements p ON p.paiement_id=a.paiement_id
    WHERE p.statut NOT IN ('annule','rejete') GROUP BY a.facture_id
  ), fx AS (
    SELECT f.facture_id, f.reference, f.client_nom, f.montant_total total,
      COALESCE(al.paye,0) paye_calc, COALESCE(f.montant_paye,0) paye_enr
    FROM public.factures f LEFT JOIN alloc al USING (facture_id)
    WHERE f.statut <> 'annulee'
  ), cl AS (
    SELECT c.client_id, c.nom, COALESCE(c.solde,0) solde_enr,
      COALESCE((SELECT sum(f.montant_total - COALESCE(al.paye,0)) FROM public.factures f
        LEFT JOIN alloc al USING (facture_id)
        WHERE f.client_id=c.client_id AND f.statut<>'annulee'),0) solde_calc
    FROM public.clients c
  )
  SELECT jsonb_build_object(
    'clients', COALESCE((SELECT jsonb_agg(jsonb_build_object('client_id',client_id,'nom',nom,
        'solde_calcule',solde_calc,'solde_enregistre',solde_enr,'ecart',solde_calc-solde_enr) ORDER BY abs(solde_calc-solde_enr) DESC)
      FROM cl WHERE abs(solde_calc-solde_enr)>0.5),'[]'::jsonb),
    'factures', COALESCE((SELECT jsonb_agg(jsonb_build_object('facture_id',facture_id,'reference',reference,'client',client_nom,
        'total',total,'paye_calcule',paye_calc,'paye_enregistre',paye_enr,'reste_calcule',total-paye_calc,
        'reste_enregistre',total-paye_enr,'ecart',paye_enr-paye_calc))
      FROM fx WHERE abs(paye_calc-paye_enr)>0.5),'[]'::jsonb),
    'paiements', jsonb_build_object(
      'actifs', (SELECT COALESCE(sum(montant),0) FROM public.paiements WHERE statut NOT IN ('annule','rejete')),
      'annules', (SELECT COALESCE(sum(montant),0) FROM public.paiements WHERE statut IN ('annule','rejete')),
      'affectes', (SELECT COALESCE(sum(a.montant),0) FROM public.payment_allocations a JOIN public.paiements p ON p.paiement_id=a.paiement_id WHERE p.statut NOT IN ('annule','rejete')),
      'supprimes', (SELECT COALESCE(sum(montant_annule),0) FROM public.paiement_annulations_audit WHERE raison='suppression_definitive'))
  ) INTO v;
  RETURN v;
END; $function$;
REVOKE EXECUTE ON FUNCTION public.report_reconciliation_finance() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_reconciliation_finance() TO authenticated;