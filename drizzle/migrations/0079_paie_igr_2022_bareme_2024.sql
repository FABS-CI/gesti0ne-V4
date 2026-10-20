CREATE OR REPLACE FUNCTION public.paie_enregistrer_bulletin(p_employe_id uuid, p_date_debut date, p_date_fin date, p_saisie jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  e record; rg record; p jsonb; v_id uuid;
  sb numeric; sur numeric; tanc numeric; anc numeric; autres numeric; tr numeric; tr_exo numeric; tr_exc numeric;
  autres_ni numeric; autres_ret numeric; parts numeric; jours numeric;
  brut numeric; non_impo numeric; its_brut numeric := 0; ricf numeric := 0; its numeric := 0;
  cn numeric := 0; igr numeric := 0; cr numeric; cmu numeric; total_fs numeric;
  net_av numeric; unite numeric; net numeric; arr numeric;
  plaf numeric; p_ret numeric; p_pf numeric; p_mat numeric; p_at numeric; p_cmu numeric; p_fdfp numeric; p_tot numeric;
BEGIN
  IF NOT (rbac3_can('rh.modifier', auth.uid()) OR is_hr(auth.uid())) THEN
    RAISE EXCEPTION 'Droit insuffisant pour créer un bulletin';
  END IF;
  IF p_date_fin < p_date_debut THEN RAISE EXCEPTION 'Période invalide'; END IF;
  SELECT * INTO e FROM employes WHERE employe_id = p_employe_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employé introuvable'; END IF;
  SELECT * INTO rg FROM paie_regimes
    WHERE code = CASE WHEN p_date_fin < DATE '2024-01-01' THEN 'REGIME_2022' ELSE 'REGIME_2024' END;
  p := rg.parametres;

  sb := GREATEST(0, COALESCE((p_saisie->>'salaire_base')::numeric, 0));
  sur := GREATEST(0, COALESCE((p_saisie->>'sursalaire')::numeric, 0));
  tanc := GREATEST(0, COALESCE((p_saisie->>'taux_anciennete')::numeric, 0));
  anc := round(sb * tanc / 100);
  autres := GREATEST(0, COALESCE((p_saisie->>'autres_gains_imposables')::numeric, 0));
  tr := GREATEST(0, COALESCE((p_saisie->>'transport')::numeric, 0));
  tr_exo := LEAST(tr, COALESCE((p->>'transport_plafond')::numeric, 30000));
  tr_exc := tr - tr_exo;
  autres_ni := GREATEST(0, COALESCE((p_saisie->>'autres_indemnites_non_imposables')::numeric, 0));
  autres_ret := GREATEST(0, COALESCE((p_saisie->>'autres_retenues')::numeric, 0));
  parts := LEAST(5, GREATEST(1, round(COALESCE((p_saisie->>'parts')::numeric, e.parts, 1) * 2) / 2));
  jours := COALESCE((p_saisie->>'jours_travailles')::numeric, 30);

  brut := sb + sur + anc + autres + tr_exc;
  non_impo := tr_exo + autres_ni;
  IF rg.code = 'REGIME_2024' THEN
    its_brut := round(_paie_bareme(brut, p->'its_bareme'));
    ricf := round((parts - 1) * 2) * COALESCE((p->>'ricf_par_demi_part')::numeric, 5500);
    its := GREATEST(0, round(its_brut - ricf));
  ELSE
    its := round(brut * (p->>'its_taux_forfait')::numeric / 100); its_brut := its;
    cn := round(_paie_bareme(floor(brut / 1000) * 1000 * (p->>'cn_abattement')::numeric / 100, p->'cn_bareme'));
    -- IGR 2022 : barème ITS 2024 moins RICF (décision utilisateur), sauf saisie manuelle
    IF p_saisie ? 'igr_manuel' THEN
      igr := COALESCE((p_saisie->>'igr_manuel')::numeric, 0);
    ELSE
      SELECT GREATEST(0, round(_paie_bareme(brut, r24.parametres->'its_bareme'))::numeric
               - round((parts - 1) * 2) * COALESCE((r24.parametres->>'ricf_par_demi_part')::numeric, 5500))
        INTO igr FROM paie_regimes r24 WHERE r24.code = 'REGIME_2024';
      igr := COALESCE(igr, 0);
    END IF;
  END IF;
  cr := round(LEAST(brut, (p->>'cr_plafond')::numeric) * (p->>'cr_taux')::numeric / 100);
  cmu := (p->>'cmu_salarie')::numeric;
  total_fs := its + cn + igr + cr;
  net_av := brut - total_fs - cmu - autres_ret + non_impo;
  unite := GREATEST(1, COALESCE((p->>'arrondi_unite')::numeric, 100));
  net := round(net_av / unite) * unite;
  arr := net - net_av;

  plaf := LEAST(brut, (p->>'plafond_prestations')::numeric);
  p_ret := round(LEAST(brut, (p->>'retraite_pat_plafond')::numeric) * (p->>'retraite_pat_taux')::numeric / 100);
  p_pf := round(plaf * (p->>'pf_taux')::numeric / 100);
  p_mat := round(plaf * (p->>'maternite_taux')::numeric / 100);
  p_at := round(plaf * (p->>'at_taux')::numeric / 100);
  p_cmu := (p->>'cmu_patronal')::numeric;
  p_fdfp := CASE WHEN (p->>'fdfp_actif')::boolean THEN round(brut * (p->>'fdfp_taux')::numeric / 100) ELSE 0 END;
  p_tot := p_ret + p_pf + p_mat + p_at + p_cmu + p_fdfp;

  INSERT INTO bulletins_paie (reference, employe_id, employe_nom, periode, date_bulletin, date_debut, date_fin,
    date_etablissement, date_paiement, mode_paiement, jours_travailles, regime_code, parts, saisie,
    salaire_brut, brut_imposable, cotisations, retenues, total_indemnites_non_imposables, total_autres_retenues,
    arrondi, net_a_payer, salaire_net, cout_salarial, statut)
  VALUES (_next_ref('BUL', 'public.bulletins_paie'::regclass, 'reference'), p_employe_id,
    COALESCE(e.nom_complet, e.prenoms), to_char(p_date_fin, 'YYYY-MM'), CURRENT_DATE,
    p_date_debut, p_date_fin, COALESCE((p_saisie->>'date_etablissement')::date, CURRENT_DATE),
    (p_saisie->>'date_paiement')::date, COALESCE(p_saisie->>'mode_paiement', e.mode_paiement_defaut),
    jours, rg.code, parts, p_saisie, brut + non_impo, brut, p_tot, total_fs + cmu + autres_ret,
    non_impo, autres_ret, arr, net, net, brut + non_impo + p_tot, 'brouillon')
  RETURNING bulletin_id INTO v_id;

  CREATE TEMP TABLE IF NOT EXISTS _bl (n text, d text, nb numeric, b numeric, t numeric, g numeric, r numeric, bl text) ON COMMIT DROP;
  TRUNCATE _bl;
  INSERT INTO _bl VALUES ('150','Salaire de base', jours, sb, NULL, sb, 0, 'imposable');
  IF sur > 0 THEN INSERT INTO _bl VALUES ('153','Sursalaire',NULL,NULL,NULL,sur,0,'imposable'); END IF;
  IF anc > 0 THEN INSERT INTO _bl VALUES ('154','Prime d''ancienneté',NULL,sb,tanc,anc,0,'imposable'); END IF;
  IF autres > 0 THEN INSERT INTO _bl VALUES ('160','Autres gains imposables',NULL,NULL,NULL,autres,0,'imposable'); END IF;
  IF tr_exc > 0 THEN INSERT INTO _bl VALUES ('503','Excédent indemnité de transport',NULL,NULL,NULL,tr_exc,0,'imposable'); END IF;
  INSERT INTO _bl VALUES ('413','I.T.S',NULL,brut,CASE WHEN rg.code='REGIME_2022' THEN (p->>'its_taux_forfait')::numeric END,0,its,'retenue');
  IF rg.code = 'REGIME_2022' THEN
    INSERT INTO _bl VALUES ('420','C.N',NULL,brut,NULL,0,cn,'retenue'), ('431','I.G.R',NULL,brut,NULL,0,igr,'retenue');
  END IF;
  INSERT INTO _bl VALUES ('469','C.R',NULL,LEAST(brut,(p->>'cr_plafond')::numeric),(p->>'cr_taux')::numeric,0,cr,'retenue');
  IF tr_exo > 0 THEN INSERT INTO _bl VALUES ('503','Indemnité de transport',NULL,NULL,NULL,tr_exo,0,'non_imposable'); END IF;
  IF autres_ni > 0 THEN INSERT INTO _bl VALUES ('510','Autres indemnités non imposables',NULL,NULL,NULL,autres_ni,0,'non_imposable'); END IF;
  INSERT INTO _bl VALUES ('776','Retenue CMU',NULL,NULL,NULL,0,cmu,'non_imposable');
  IF autres_ret > 0 THEN INSERT INTO _bl VALUES ('780','Autres retenues',NULL,NULL,NULL,0,autres_ret,'non_imposable'); END IF;
  INSERT INTO _bl VALUES ('900','Arrondi de paie',NULL,NULL,NULL,GREATEST(arr,0),GREATEST(-arr,0),'arrondi');
  INSERT INTO _bl SELECT '', x.d, NULL, NULL, NULL, 0, x.m, 'patronal' FROM (VALUES
    ('Retraite (part patronale)',p_ret),('Prestations familiales',p_pf),('Maternité',p_mat),
    ('Accidents du travail',p_at),('CMU patronale',p_cmu),('Taxes de formation (FDFP)',p_fdfp)) x(d,m) WHERE x.m > 0;

  INSERT INTO bulletin_lignes (bulletin_id, code, libelle, numero_rubrique, designation, nombre, base, taux,
    montant, gain, retenue, type, bloc, ordre)
  SELECT v_id, n, d, n, d, nb, COALESCE(b,0), COALESCE(t,0), g + r, g, r,
    CASE WHEN g > 0 THEN 'gain' ELSE 'retenue' END, bl, row_number() OVER ()
  FROM _bl;
  RETURN v_id;
END $function$;