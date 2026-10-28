-- Paie : les absences non payées réduisent le salaire, et une prime n'est comptée qu'une fois.
--
-- Avant (0084) :
--   * absences non justifiées et congés sans solde comptés dans jours_travailles, mais ce nombre
--     n'entrait dans aucun calcul : salaire, sursalaire, ancienneté et transport payés en entier ;
--     une absence chevauchant un congé sans solde était comptée deux fois ;
--   * une prime de la fiche liée à une rubrique personnalisée fixe/pourcentage était ajoutée par la
--     fiche, puis une seconde fois par la boucle « appliquée à tous ».
--
-- Désormais :
--   * salaire de base, sursalaire (donc ancienneté) et transport sont proratisés : montant x jours / jours_mois ;
--   * les jours d'absence sont comptés une seule fois (union des absences et des congés sans solde) ;
--   * une rubrique déjà présente sur la fiche n'est plus appliquée une seconde fois.

CREATE OR REPLACE FUNCTION public.paie_calculer_bulletin(p_employe_id uuid, p_date_debut date, p_date_fin date, p_saisie jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  e record; v_reg text; p jsonb; s jsonb := COALESCE(p_saisie, '{}'::jsonb); src jsonb := '{}'::jsonb;
  L jsonb := '[]'::jsonb; anom jsonb := '[]'::jsonb; it jsonb; rb record;
  sb numeric; sur numeric; tanc numeric; anc numeric; annees int; autres numeric := 0; tr numeric; tr_exo numeric; tr_exc numeric;
  autres_ni numeric := 0; autres_ret numeric := 0; parts numeric; jours numeric; jmois numeric; abs_j numeric := 0;
  brut numeric; non_impo numeric; its numeric := 0; cn numeric := 0; igr numeric := 0; cr numeric; cmu numeric; total_fs numeric;
  net_av numeric; unite numeric; net numeric; arr numeric; m numeric; plafr numeric; extra jsonb := '[]'::jsonb;
  plaf numeric; p_ret numeric; p_pf numeric; p_mat numeric; p_at numeric; p_cmu numeric; p_fdfp numeric; p_tot numeric;
  prorata numeric := 1; sb_plein numeric; sur_plein numeric; tr_plein numeric; codes_fiche text[] := '{}';
BEGIN
  IF NOT (rbac3_can('rh.modifier', auth.uid()) OR is_hr(auth.uid())) THEN RAISE EXCEPTION 'Droit insuffisant pour calculer un bulletin'; END IF;
  IF p_date_fin < p_date_debut THEN RAISE EXCEPTION 'Période invalide'; END IF;
  SELECT * INTO e FROM employes WHERE employe_id = p_employe_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employé introuvable'; END IF;
  v_reg := CASE WHEN p_date_fin < DATE '2024-01-01' THEN 'REGIME_2022' ELSE 'REGIME_2024' END;
  p := _paie_parametres_effectifs(v_reg, p_date_fin);
  jmois := COALESCE((p->>'jours_mois')::numeric, 30);

  IF COALESCE(e.salaire,0) <= 0 AND NOT s ? 'salaire_base' THEN anom := anom || '"Salaire de base manquant"'; END IF;
  IF COALESCE(trim(e.numero_cnps),'') = '' THEN anom := anom || '"N° CNPS manquant"'; END IF;
  IF e.parts IS NULL THEN anom := anom || '"Parts non définies"'; END IF;
  IF e.date_embauche IS NULL THEN anom := anom || '"Date d''embauche manquante"'; END IF;

  -- Salaire, sursalaire, parts
  IF s ? 'salaire_base' THEN sb := GREATEST(0,(s->>'salaire_base')::numeric); src := src || '{"salaire_base":"Saisie manuelle"}';
  ELSE sb := GREATEST(0, COALESCE(e.salaire,0)); src := src || '{"salaire_base":"RH"}'; END IF;
  IF s ? 'sursalaire' THEN sur := GREATEST(0,(s->>'sursalaire')::numeric); src := src || '{"sursalaire":"Saisie manuelle"}';
  ELSE sur := GREATEST(0, COALESCE(e.sursalaire,0)); src := src || '{"sursalaire":"RH"}'; END IF;
  IF s ? 'parts' THEN parts := (s->>'parts')::numeric; src := src || '{"parts":"Saisie manuelle"}';
  ELSE parts := COALESCE(e.parts,1); src := src || '{"parts":"RH"}'; END IF;
  parts := LEAST(5, GREATEST(1, round(parts * 2) / 2));

  -- Ancienneté
  IF s ? 'taux_anciennete' THEN tanc := GREATEST(0,(s->>'taux_anciennete')::numeric); src := src || '{"taux_anciennete":"Saisie manuelle"}';
  ELSIF e.date_embauche IS NOT NULL THEN
    annees := GREATEST(0, extract(year FROM age(p_date_fin, e.date_embauche))::int);
    tanc := LEAST(COALESCE((p->>'anciennete_plafond')::numeric,25), annees * COALESCE((p->>'anciennete_taux_par_an')::numeric,1));
    src := src || '{"taux_anciennete":"Paramètre"}';
  ELSE tanc := 0; END IF;
  anc := round(sb * tanc / 100);

  -- Jours travaillés
  IF s ? 'jours_travailles' THEN jours := (s->>'jours_travailles')::numeric; src := src || '{"jours_travailles":"Saisie manuelle"}';
  ELSE
    -- Jours non payés comptés une seule fois : union des absences non justifiées et des congés sans solde.
    SELECT count(DISTINCT j) INTO abs_j FROM (
      SELECT generate_series(GREATEST(a.date_debut, p_date_debut), LEAST(a.date_fin, p_date_fin), interval '1 day')::date AS j
        FROM absences a WHERE a.employe_id = p_employe_id AND a.justifie IS FALSE
         AND COALESCE(a.statut,'') NOT IN ('annule','annulee','refuse','refusee','rejete','rejetee')
         AND a.date_debut <= p_date_fin AND a.date_fin >= p_date_debut
      UNION ALL
      SELECT generate_series(GREATEST(c.date_debut, p_date_debut), LEAST(c.date_fin, p_date_fin), interval '1 day')::date
        FROM conges c WHERE c.employe_id = p_employe_id AND c.type ILIKE '%sans solde%'
         AND (c.statut ILIKE 'approuv%' OR c.statut ILIKE 'valid%')
         AND c.date_debut <= p_date_fin AND c.date_fin >= p_date_debut
    ) x;
    jours := GREATEST(0, jmois - abs_j); src := src || '{"jours_travailles":"RH"}';
  END IF;

  -- Prorata des jours non payés : salaire de base et sursalaire (donc ancienneté), puis transport.
  prorata := CASE WHEN jmois > 0 THEN LEAST(1, GREATEST(0, jours) / jmois) ELSE 1 END;
  sb_plein := sb; sur_plein := sur;
  sb := round(sb * prorata); sur := round(sur * prorata);
  anc := round(sb * tanc / 100);

  -- Transport
  IF s ? 'transport' THEN tr := GREATEST(0,(s->>'transport')::numeric); src := src || '{"transport":"Saisie manuelle"}';
  ELSE
    SELECT COALESCE(sum((x->>'montant')::numeric),0) INTO tr FROM jsonb_array_elements(COALESCE(e.indemnites,'[]'::jsonb)) x
      WHERE x->>'rubrique_code' = '503' OR (x->>'rubrique_code' IS NULL AND x->>'libelle' ILIKE '%transport%');
    src := src || '{"transport":"RH"}';
  END IF;
  tr_plein := tr; tr := round(tr * prorata);
  tr_exo :=LEAST(tr, COALESCE((p->>'transport_plafond')::numeric, 30000)); tr_exc := tr - tr_exo;

  autres := GREATEST(0, COALESCE((s->>'autres_gains_imposables')::numeric, 0));
  autres_ni := GREATEST(0, COALESCE((s->>'autres_indemnites_non_imposables')::numeric, 0));
  autres_ret := GREATEST(0, COALESCE((s->>'autres_retenues')::numeric, 0));

  -- Primes / indemnités de la fiche liées à une rubrique
  FOR it IN SELECT x FROM jsonb_array_elements(COALESCE(e.primes,'[]'::jsonb) || COALESCE(e.indemnites,'[]'::jsonb)) x
    WHERE COALESCE(x->>'rubrique_code','') NOT IN ('', '503')
  LOOP
    SELECT * INTO rb FROM rubriques_paie WHERE code = it->>'rubrique_code' OR numero = it->>'rubrique_code' LIMIT 1;
    m := GREATEST(0, COALESCE((it->>'montant')::numeric, 0));
    IF rb.rubrique_id IS NOT NULL THEN codes_fiche := codes_fiche || rb.code || rb.numero; END IF;
    IF rb.rubrique_id IS NULL OR NOT rb.actif THEN anom := anom || to_jsonb('Rubrique inactive ou inconnue : ' || (it->>'rubrique_code')); CONTINUE; END IF;
    IF m <= 0 THEN CONTINUE; END IF;
    extra := extra || jsonb_build_object('n', COALESCE(rb.numero, rb.code), 'd', COALESCE(it->>'libelle', rb.libelle), 'm', m,
      'type', rb.type, 'imp', COALESCE(rb.imposable, rb.soumis_its, true), 'plaf', rb.plafond, 'ordre', rb.ordre);
  END LOOP;
  -- Rubriques personnalisées actives à montant fixe / pourcentage (appliquées à tous),
  -- sauf celles déjà portées par la fiche de l'employé (sinon la prime est comptée deux fois).
  FOR rb IN SELECT * FROM rubriques_paie WHERE actif AND NOT systeme AND mode_calcul IN ('fixe','pourcentage')
      AND NOT (code = ANY(codes_fiche) OR numero = ANY(codes_fiche)) ORDER BY ordre, code LOOP
    m := CASE WHEN rb.mode_calcul = 'fixe' THEN COALESCE(rb.montant_fixe,0) ELSE round(sb * COALESCE(rb.taux,0) / 100) END;
    IF m > 0 THEN extra := extra || jsonb_build_object('n', COALESCE(rb.numero, rb.code), 'd', rb.libelle, 'm', m,
      'type', rb.type, 'imp', COALESCE(rb.imposable, rb.soumis_its, true), 'plaf', rb.plafond, 'ordre', rb.ordre); END IF;
  END LOOP;

  brut := sb + sur + anc + autres + tr_exc;
  non_impo := tr_exo + autres_ni;
  FOR it IN SELECT x FROM jsonb_array_elements(extra) x LOOP
    m := (it->>'m')::numeric;
    IF it->>'type' = 'retenue' THEN autres_ret := autres_ret + m;
    ELSIF (it->>'imp')::boolean THEN brut := brut + m;
    ELSE plafr := COALESCE((it->>'plaf')::numeric, m);
      non_impo := non_impo + LEAST(m, plafr); brut := brut + GREATEST(0, m - plafr); END IF;
  END LOOP;

  IF v_reg = 'REGIME_2024' THEN its := 0;
  ELSE
    its := round(brut * COALESCE((p->>'its_taux_forfait')::numeric,0) / 100);
    cn := round(_paie_bareme(floor(brut / 1000) * 1000 * COALESCE((p->>'cn_abattement')::numeric,0) / 100, p->'cn_bareme'));
    IF s ? 'igr_manuel' THEN igr := COALESCE((s->>'igr_manuel')::numeric, 0);
    ELSE
      SELECT GREATEST(0, round(_paie_bareme(brut, r24->'its_bareme')) - round((parts - 1) * 2) * COALESCE((r24->>'ricf_par_demi_part')::numeric, 5500))
        INTO igr FROM (SELECT _paie_parametres_effectifs('REGIME_2024', p_date_fin) r24) q;
      igr := COALESCE(igr, 0);
    END IF;
  END IF;
  cr := round(LEAST(brut, (p->>'cr_plafond')::numeric) * (p->>'cr_taux')::numeric / 100);
  cmu := COALESCE((p->>'cmu_salarie')::numeric, 0);
  total_fs := its + cn + igr + cr + cmu;
  net_av := brut - total_fs - autres_ret + non_impo;
  unite := GREATEST(1, COALESCE((p->>'arrondi_unite')::numeric, 5));
  net := CASE WHEN COALESCE(p->>'arrondi_mode','superieur') = 'proche' THEN round(net_av / unite) ELSE ceil(net_av / unite) END * unite;
  arr := net - net_av;

  plaf := LEAST(brut, (p->>'plafond_prestations')::numeric);
  p_ret := round(LEAST(brut, (p->>'retraite_pat_plafond')::numeric) * (p->>'retraite_pat_taux')::numeric / 100);
  p_pf := round(plaf * (p->>'pf_taux')::numeric / 100);
  p_mat := round(plaf * COALESCE((p->>'maternite_taux')::numeric,0) / 100);
  p_at := round(plaf * (p->>'at_taux')::numeric / 100);
  p_cmu := COALESCE((p->>'cmu_patronal')::numeric,0);
  p_fdfp := CASE WHEN COALESCE((p->>'fdfp_actif')::boolean,false) THEN round(brut * (p->>'fdfp_taux')::numeric / 100) ELSE 0 END;
  p_tot := p_ret + p_pf + p_mat + p_at + p_cmu + p_fdfp;

  L := L || jsonb_build_object('n','150','d','Salaire de base','nb',jours,'b',sb_plein,'g',sb,'r',0,'bl','imposable');
  IF sur > 0 THEN L := L || jsonb_build_object('n','153','d','Sursalaire','g',sur,'r',0,'bl','imposable'); END IF;
  IF anc > 0 THEN L := L || jsonb_build_object('n','154','d','Prime d''ancienneté','b',sb,'t',tanc,'g',anc,'r',0,'bl','imposable'); END IF;
  IF autres > 0 THEN L := L || jsonb_build_object('n','160','d','Autres gains imposables','g',autres,'r',0,'bl','imposable'); END IF;
  FOR it IN SELECT x FROM jsonb_array_elements(extra) x WHERE x->>'type' <> 'retenue' LOOP
    m := (it->>'m')::numeric;
    IF (it->>'imp')::boolean THEN L := L || jsonb_build_object('n',it->>'n','d',it->>'d','g',m,'r',0,'bl','imposable');
    ELSE plafr := COALESCE((it->>'plaf')::numeric, m);
      IF m > plafr THEN L := L || jsonb_build_object('n',it->>'n','d','Excédent '||(it->>'d'),'g',m-plafr,'r',0,'bl','imposable'); END IF;
    END IF;
  END LOOP;
  IF tr_exc > 0 THEN L := L || jsonb_build_object('n','503','d','Excédent indemnité de transport','g',tr_exc,'r',0,'bl','imposable'); END IF;
  L := L || jsonb_build_object('n','401','d','ITS (Part salariale)','b',brut,'t',CASE WHEN v_reg='REGIME_2022' THEN (p->>'its_taux_forfait')::numeric END,'g',0,'r',its,'bl','retenue');
  IF v_reg = 'REGIME_2022' THEN
    L := L || jsonb_build_object('n','420','d','C.N','b',brut,'g',0,'r',cn,'bl','retenue')
           || jsonb_build_object('n','431','d','I.G.R','b',brut,'g',0,'r',igr,'bl','retenue');
  END IF;
  L := L || jsonb_build_object('n','469','d','C.R','b',LEAST(brut,(p->>'cr_plafond')::numeric),'t',(p->>'cr_taux')::numeric,'g',0,'r',cr,'bl','retenue');
  L := L || jsonb_build_object('n','470','d','CMU (Couverture Maladie Univ.)','g',0,'r',cmu,'bl','retenue');
  IF tr_exo > 0 THEN L := L || jsonb_build_object('n','503','d','Indemnité de transport','nb',jours,'b',(p->>'transport_plafond')::numeric,'g',tr_exo,'r',0,'bl','non_imposable'); END IF;
  IF autres_ni > 0 THEN L := L || jsonb_build_object('n','510','d','Autres indemnités non imposables','g',autres_ni,'r',0,'bl','non_imposable'); END IF;
  FOR it IN SELECT x FROM jsonb_array_elements(extra) x WHERE x->>'type' <> 'retenue' AND NOT (x->>'imp')::boolean LOOP
    m := LEAST((it->>'m')::numeric, COALESCE((it->>'plaf')::numeric, (it->>'m')::numeric));
    L := L || jsonb_build_object('n',it->>'n','d',it->>'d','g',m,'r',0,'bl','non_imposable');
  END LOOP;
  IF COALESCE((s->>'autres_retenues')::numeric,0) > 0 THEN L := L || jsonb_build_object('n','780','d','Autres retenues','g',0,'r',(s->>'autres_retenues')::numeric,'bl','non_imposable'); END IF;
  FOR it IN SELECT x FROM jsonb_array_elements(extra) x WHERE x->>'type' = 'retenue' LOOP
    L := L || jsonb_build_object('n',it->>'n','d',it->>'d','g',0,'r',(it->>'m')::numeric,'bl','non_imposable');
  END LOOP;
  L := L || jsonb_build_object('n','900','d','Arrondi de paie','g',GREATEST(arr,0),'r',GREATEST(-arr,0),'bl','arrondi');
  SELECT L || COALESCE(jsonb_agg(jsonb_build_object('n','','d',x.d,'g',0,'r',x.m,'bl','patronal')),'[]'::jsonb) INTO L FROM (VALUES
    ('Retraite (part patronale)',p_ret),('Prestations familiales',p_pf),('Maternité',p_mat),
    ('Accidents du travail',p_at),('CMU patronale',p_cmu),('Taxes de formation (FDFP)',p_fdfp)) x(d,m) WHERE x.m > 0;

  RETURN jsonb_build_object(
    'regime', v_reg, 'jours', jours, 'parts', parts, 'lignes', L, 'anomalies', anom, 'sources', src,
    -- Montants mensuels de la fiche ; les montants payés (après prorata) sont dans les lignes.
    'salaire_base', sb_plein, 'sursalaire', sur_plein, 'taux_anciennete', tanc, 'transport', tr_plein,
    'prorata', prorata, 'salaire_base_paye', sb, 'sursalaire_paye', sur, 'transport_paye', tr,
    'brut_imposable', brut, 'non_imposable', non_impo, 'its', its, 'cn', cn, 'igr', igr, 'cr', cr, 'cmu', cmu,
    'total_retenues_fs', total_fs, 'autres_retenues', autres_ret, 'net_avant_arrondi', net_av, 'arrondi', arr, 'net', net,
    'patronal', jsonb_build_object('retraite',p_ret,'pf',p_pf,'maternite',p_mat,'at',p_at,'cmu',p_cmu,'fdfp',p_fdfp,'total',p_tot),
    'cout_salarial', brut + non_impo + p_tot,
    'snapshot', jsonb_build_object('parametres', p, 'employe', jsonb_build_object('salaire', e.salaire, 'sursalaire', e.sursalaire,
      'parts', e.parts, 'date_embauche', e.date_embauche, 'primes', e.primes, 'indemnites', e.indemnites,
      'matricule', e.matricule, 'numero_cnps', e.numero_cnps, 'categorie', e.categorie, 'poste', e.poste), 'saisie', s));
END $$;

REVOKE ALL ON FUNCTION public.paie_calculer_bulletin(uuid, date, date, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.paie_calculer_bulletin(uuid, date, date, jsonb) TO authenticated;
