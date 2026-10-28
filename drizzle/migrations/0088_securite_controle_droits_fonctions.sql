CREATE OR REPLACE FUNCTION public.paie_enregistrer_bulletin(p_employe_id uuid, p_date_debut date, p_date_fin date, p_saisie jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE c jsonb; e record; v_id uuid; s jsonb := COALESCE(p_saisie,'{}'::jsonb);
BEGIN
  PERFORM public.assert_permission('paie.creer');
  c := paie_calculer_bulletin(p_employe_id, p_date_debut, p_date_fin, s);
  SELECT * INTO e FROM employes WHERE employe_id = p_employe_id;
  INSERT INTO bulletins_paie (reference, employe_id, employe_nom, periode, date_bulletin, date_debut, date_fin,
    date_etablissement, date_paiement, mode_paiement, jours_travailles, regime_code, parts, saisie, snapshot,
    salaire_brut, brut_imposable, cotisations, retenues, total_indemnites_non_imposables, total_autres_retenues,
    arrondi, net_a_payer, salaire_net, cout_salarial, statut)
  VALUES (_next_ref('BUL', 'public.bulletins_paie'::regclass, 'reference'), p_employe_id,
    COALESCE(e.nom_complet, e.prenoms), public.paie_periode_label(p_date_fin), CURRENT_DATE,
    p_date_debut, p_date_fin, COALESCE((s->>'date_etablissement')::date, CURRENT_DATE),
    (s->>'date_paiement')::date, COALESCE(s->>'mode_paiement', e.mode_paiement_defaut, e.mode_paiement),
    (c->>'jours')::numeric, c->>'regime', (c->>'parts')::numeric, s, c->'snapshot',
    (c->>'brut_imposable')::numeric + (c->>'non_imposable')::numeric, (c->>'brut_imposable')::numeric,
    (c->'patronal'->>'total')::numeric, (c->>'total_retenues_fs')::numeric + (c->>'autres_retenues')::numeric,
    (c->>'non_imposable')::numeric, (c->>'autres_retenues')::numeric, (c->>'arrondi')::numeric,
    (c->>'net')::numeric, (c->>'net')::numeric, (c->>'cout_salarial')::numeric, 'brouillon')
  RETURNING bulletin_id INTO v_id;

  INSERT INTO bulletin_lignes (bulletin_id, code, libelle, numero_rubrique, designation, nombre, base, taux,
    montant, gain, retenue, type, bloc, ordre)
  SELECT v_id, x->>'n', x->>'d', x->>'n', x->>'d', (x->>'nb')::numeric, COALESCE((x->>'b')::numeric,0), COALESCE((x->>'t')::numeric,0),
    (x->>'g')::numeric + (x->>'r')::numeric, (x->>'g')::numeric, (x->>'r')::numeric,
    CASE WHEN (x->>'g')::numeric > 0 THEN 'gain' ELSE 'retenue' END, x->>'bl', o
  FROM jsonb_array_elements(c->'lignes') WITH ORDINALITY t(x, o);
  RETURN v_id;
END $function$;

CREATE OR REPLACE FUNCTION public.signaler_ecart_total_document(_type text, _reference text, _stocke numeric, _calcule numeric)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR abs(COALESCE(_stocke,0) - COALESCE(_calcule,0)) < 1 THEN RETURN; END IF;
  -- Contrôle de droit : seul un compte qui peut voir les factures peut signaler un écart (sinon ignoré, sans bloquer le PDF)
  IF NOT public.has_permission_v2(auth.uid(), 'factures.voir') THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.incident_alerts WHERE source = 'pdf_total_coherence' AND resolved = false
             AND metadata->>'reference' = _reference) THEN RETURN; END IF;
  INSERT INTO public.incident_alerts(title, message, severity, source, metadata)
  VALUES ('Écart de total sur un document',
          format('%s %s : total enregistré %s, total recalculé %s', _type, _reference, _stocke, _calcule),
          'warning', 'pdf_total_coherence',
          jsonb_build_object('type', _type, 'reference', _reference, 'stocke', _stocke, 'calcule', _calcule, 'user_id', auth.uid()));
END; $function$;

REVOKE EXECUTE ON FUNCTION public.allocate_payment_to_invoice_lines(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_facture_from_payment_allocations(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_ecriture_facture(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_ecriture_paiement(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_ecriture_achat(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_ecriture_retour(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.commande_demander_annulation(uuid,text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.inventaire_demander_validation(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.approbation_creer(text,text,text,uuid,text,numeric,text,text,integer,jsonb) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculer_sla_approbations() FROM public, anon, authenticated;