ALTER TABLE public.employes ADD COLUMN IF NOT EXISTS sursalaire numeric NOT NULL DEFAULT 0;
ALTER TABLE public.employes ADD COLUMN IF NOT EXISTS nombre_enfants integer NOT NULL DEFAULT 0;
ALTER TABLE public.parametres_paie ADD COLUMN IF NOT EXISTS regime_code text;
ALTER TABLE public.parametres_paie ADD COLUMN IF NOT EXISTS date_effet date;
ALTER TABLE public.rubriques_paie ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE public.rubriques_paie ADD COLUMN IF NOT EXISTS bloc text;
ALTER TABLE public.rubriques_paie ADD COLUMN IF NOT EXISTS plafond numeric;
ALTER TABLE public.rubriques_paie ADD COLUMN IF NOT EXISTS imposable boolean NOT NULL DEFAULT true;
ALTER TABLE public.rubriques_paie ADD COLUMN IF NOT EXISTS afficher_si_zero boolean NOT NULL DEFAULT false;
ALTER TABLE public.rubriques_paie ADD COLUMN IF NOT EXISTS systeme boolean NOT NULL DEFAULT false;
ALTER TABLE public.bulletins_paie ADD COLUMN IF NOT EXISTS snapshot jsonb;

CREATE OR REPLACE FUNCTION public._rubrique_protect_systeme() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.systeme THEN RAISE EXCEPTION 'Rubrique système non supprimable'; END IF;
    IF EXISTS (SELECT 1 FROM bulletin_lignes WHERE numero_rubrique = COALESCE(OLD.numero, OLD.code) OR code = OLD.code) THEN
      RAISE EXCEPTION 'Rubrique utilisée dans un bulletin : désactivez-la au lieu de la supprimer';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.systeme AND (NEW.code IS DISTINCT FROM OLD.code OR NEW.numero IS DISTINCT FROM OLD.numero
     OR NEW.mode_calcul IS DISTINCT FROM OLD.mode_calcul OR NEW.type IS DISTINCT FROM OLD.type OR NOT NEW.systeme) THEN
    RAISE EXCEPTION 'Rubrique système : seuls le libellé et l''ordre sont modifiables';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_rubrique_protect ON public.rubriques_paie;
CREATE TRIGGER trg_rubrique_protect BEFORE UPDATE OR DELETE ON public.rubriques_paie FOR EACH ROW EXECUTE FUNCTION public._rubrique_protect_systeme();
DROP TRIGGER IF EXISTS audit_crud_rubriques_paie ON public.rubriques_paie;
CREATE TRIGGER audit_crud_rubriques_paie AFTER INSERT OR UPDATE OR DELETE ON public.rubriques_paie FOR EACH ROW EXECUTE FUNCTION public.audit_crud_trigger();
DROP TRIGGER IF EXISTS audit_crud_parametres_paie ON public.parametres_paie;
CREATE TRIGGER audit_crud_parametres_paie AFTER INSERT OR UPDATE OR DELETE ON public.parametres_paie FOR EACH ROW EXECUTE FUNCTION public.audit_crud_trigger();

-- Paramètres effectifs : paie_regimes.parametres surchargés par parametres_paie actifs
CREATE OR REPLACE FUNCTION public._paie_parametres_effectifs(p_regime text, p_date date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p jsonb; r record; k text;
BEGIN
  SELECT parametres INTO p FROM paie_regimes WHERE code = p_regime;
  p := COALESCE(p, '{}'::jsonb);
  FOR r IN SELECT cle, valeur FROM parametres_paie
    WHERE actif IS NOT FALSE AND (regime_code IS NULL OR regime_code = p_regime)
      AND (date_effet IS NULL OR date_effet <= p_date)
    ORDER BY (regime_code IS NOT NULL), date_effet NULLS FIRST
  LOOP
    k := CASE upper(r.cle)
      WHEN 'CNPS_RETRAITE_SALARIE' THEN 'cr_taux' WHEN 'CNPS_SALARIE_RETRAITE' THEN 'cr_taux'
      WHEN 'CNPS_RETRAITE_PATRONAL' THEN 'retraite_pat_taux' WHEN 'CNPS_PATRONAL_RETRAITE' THEN 'retraite_pat_taux'
      WHEN 'CNPS_ACCIDENT_TRAVAIL' THEN 'at_taux' WHEN 'CMU_SALARIE' THEN 'cmu_salarie' WHEN 'CMU_PATRONAL' THEN 'cmu_patronal'
      ELSE lower(r.cle) END;
    IF p ? k AND r.valeur ~ '^-?[0-9]+(\.[0-9]+)?$' THEN p := p || jsonb_build_object(k, r.valeur::numeric);
    ELSIF k IN ('anciennete_taux_par_an','anciennete_plafond','jours_mois') AND r.valeur ~ '^[0-9]+(\.[0-9]+)?$' THEN
      p := p || jsonb_build_object(k, r.valeur::numeric);
    END IF;
  END LOOP;
  RETURN p;
END $$;

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
    SELECT COALESCE(sum(LEAST(a.date_fin, p_date_fin) - GREATEST(a.date_debut, p_date_debut) + 1),0) INTO abs_j
      FROM absences a WHERE a.employe_id = p_employe_id AND a.justifie IS FALSE
       AND COALESCE(a.statut,'') NOT IN ('annule','annulee','refuse','refusee','rejete','rejetee')
       AND a.date_debut <= p_date_fin AND a.date_fin >= p_date_debut;
    SELECT abs_j + COALESCE(sum(LEAST(c.date_fin, p_date_fin) - GREATEST(c.date_debut, p_date_debut) + 1),0) INTO abs_j
      FROM conges c WHERE c.employe_id = p_employe_id AND c.type ILIKE '%sans solde%'
       AND (c.statut ILIKE 'approuv%' OR c.statut ILIKE 'valid%')
       AND c.date_debut <= p_date_fin AND c.date_fin >= p_date_debut;
    jours := GREATEST(0, jmois - abs_j); src := src || '{"jours_travailles":"RH"}';
  END IF;

  -- Transport
  IF s ? 'transport' THEN tr := GREATEST(0,(s->>'transport')::numeric); src := src || '{"transport":"Saisie manuelle"}';
  ELSE
    SELECT COALESCE(sum((x->>'montant')::numeric),0) INTO tr FROM jsonb_array_elements(COALESCE(e.indemnites,'[]'::jsonb)) x
      WHERE x->>'rubrique_code' = '503' OR (x->>'rubrique_code' IS NULL AND x->>'libelle' ILIKE '%transport%');
    src := src || '{"transport":"RH"}';
  END IF;
  tr_exo := LEAST(tr, COALESCE((p->>'transport_plafond')::numeric, 30000)); tr_exc := tr - tr_exo;

  autres := GREATEST(0, COALESCE((s->>'autres_gains_imposables')::numeric, 0));
  autres_ni := GREATEST(0, COALESCE((s->>'autres_indemnites_non_imposables')::numeric, 0));
  autres_ret := GREATEST(0, COALESCE((s->>'autres_retenues')::numeric, 0));

  -- Primes / indemnités de la fiche liées à une rubrique
  FOR it IN SELECT x FROM jsonb_array_elements(COALESCE(e.primes,'[]'::jsonb) || COALESCE(e.indemnites,'[]'::jsonb)) x
    WHERE COALESCE(x->>'rubrique_code','') NOT IN ('', '503')
  LOOP
    SELECT * INTO rb FROM rubriques_paie WHERE code = it->>'rubrique_code' OR numero = it->>'rubrique_code' LIMIT 1;
    m := GREATEST(0, COALESCE((it->>'montant')::numeric, 0));
    IF rb.rubrique_id IS NULL OR NOT rb.actif THEN anom := anom || to_jsonb('Rubrique inactive ou inconnue : ' || (it->>'rubrique_code')); CONTINUE; END IF;
    IF m <= 0 THEN CONTINUE; END IF;
    extra := extra || jsonb_build_object('n', COALESCE(rb.numero, rb.code), 'd', COALESCE(it->>'libelle', rb.libelle), 'm', m,
      'type', rb.type, 'imp', COALESCE(rb.imposable, rb.soumis_its, true), 'plaf', rb.plafond, 'ordre', rb.ordre);
  END LOOP;
  -- Rubriques personnalisées actives à montant fixe / pourcentage (appliquées à tous)
  FOR rb IN SELECT * FROM rubriques_paie WHERE actif AND NOT systeme AND mode_calcul IN ('fixe','pourcentage') ORDER BY ordre, code LOOP
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

  L := L || jsonb_build_object('n','150','d','Salaire de base','nb',jours,'b',sb,'g',sb,'r',0,'bl','imposable');
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
    'salaire_base', sb, 'sursalaire', sur, 'taux_anciennete', tanc, 'transport', tr,
    'brut_imposable', brut, 'non_imposable', non_impo, 'its', its, 'cn', cn, 'igr', igr, 'cr', cr, 'cmu', cmu,
    'total_retenues_fs', total_fs, 'autres_retenues', autres_ret, 'net_avant_arrondi', net_av, 'arrondi', arr, 'net', net,
    'patronal', jsonb_build_object('retraite',p_ret,'pf',p_pf,'maternite',p_mat,'at',p_at,'cmu',p_cmu,'fdfp',p_fdfp,'total',p_tot),
    'cout_salarial', brut + non_impo + p_tot,
    'snapshot', jsonb_build_object('parametres', p, 'employe', jsonb_build_object('salaire', e.salaire, 'sursalaire', e.sursalaire,
      'parts', e.parts, 'date_embauche', e.date_embauche, 'primes', e.primes, 'indemnites', e.indemnites,
      'matricule', e.matricule, 'numero_cnps', e.numero_cnps, 'categorie', e.categorie, 'poste', e.poste), 'saisie', s));
END $$;

CREATE OR REPLACE FUNCTION public.paie_enregistrer_bulletin(p_employe_id uuid, p_date_debut date, p_date_fin date, p_saisie jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c jsonb; e record; v_id uuid; s jsonb := COALESCE(p_saisie,'{}'::jsonb);
BEGIN
  c := paie_calculer_bulletin(p_employe_id, p_date_debut, p_date_fin, s);
  SELECT * INTO e FROM employes WHERE employe_id = p_employe_id;
  INSERT INTO bulletins_paie (reference, employe_id, employe_nom, periode, date_bulletin, date_debut, date_fin,
    date_etablissement, date_paiement, mode_paiement, jours_travailles, regime_code, parts, saisie, snapshot,
    salaire_brut, brut_imposable, cotisations, retenues, total_indemnites_non_imposables, total_autres_retenues,
    arrondi, net_a_payer, salaire_net, cout_salarial, statut)
  VALUES (_next_ref('BUL', 'public.bulletins_paie'::regclass, 'reference'), p_employe_id,
    COALESCE(e.nom_complet, e.prenoms), to_char(p_date_fin, 'YYYY-MM'), CURRENT_DATE,
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
END $$;

REVOKE ALL ON FUNCTION public.paie_calculer_bulletin(uuid, date, date, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.paie_calculer_bulletin(uuid, date, date, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public._paie_parametres_effectifs(text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._paie_parametres_effectifs(text, date) TO authenticated;