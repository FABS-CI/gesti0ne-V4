-- Clôture d'exercice fondée sur la comptabilité (audit Comptabilité, phase 1).
--
-- Constats :
--   1. L'aperçu de clôture renvoyait des compteurs (nb_ecritures, total_ca…) alors que
--      l'écran attend exercice, blocages et peut_cloturer : l'aperçu était inutilisable.
--      Aucun contrôle n'était fait (anomalies toujours vides).
--   2. La clôture n'exigeait ni l'équilibre des écritures, ni la comptabilisation des
--      pièces, ni la clôture de l'exercice précédent, ni la fin de l'exercice.
--   3. Elle copiait les impayés clients de l'exercice dans soldes_ouverture_clients.
--      Or l'état de compte client et la liste des débiteurs reprennent déjà toutes les
--      factures depuis l'origine : ces impayés étaient comptés deux fois (et une fois de
--      plus à chaque clôture dans la liste des débiteurs, qui additionne tous les
--      exercices). Les soldes d'ouverture clients restent réservés à la reprise de
--      l'existant (avant l'ERP).
--   4. Le report fournisseurs ne prenait que les achats de l'exercice, brouillons
--      compris, et oubliait les impayés plus anciens.
--   5. compta_balance regroupait par compte ET libellé : un compte absent du plan
--      comptable sortait sur autant de lignes que de libellés d'écriture.
--
-- Le bilan reste calculé sur des soldes cumulés (aucune écriture d'à-nouveaux, voir
-- 0103) : les à-nouveaux sont calculés par compta_balance_exercice, et les résultats
-- antérieurs non affectés vont au report à nouveau, comme dans les états financiers.

-- ─── 1. Balance : un compte, une ligne ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.compta_balance(p_from date DEFAULT NULL, p_to date DEFAULT NULL, p_exercice_id uuid DEFAULT NULL)
RETURNS TABLE(numero_compte text, libelle text, debit numeric, credit numeric, solde numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_permission(auth.uid(), 'comptabilite.voir') THEN
    RAISE EXCEPTION 'Permission refusée : comptabilite.voir' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH l AS (
    SELECT coalesce(nullif(btrim(el.numero_compte), ''), pci.numero, '???') AS num,
           nullif(btrim(el.compte_libelle), '') AS lib,
           coalesce(el.debit, 0) AS d, coalesce(el.credit, 0) AS c
      FROM public.ecriture_lignes el
      JOIN public.ecritures_comptables ec ON ec.ecriture_id = el.ecriture_id
      LEFT JOIN public.plan_comptable pci ON pci.compte_id = el.compte_id
     WHERE (p_from IS NULL OR ec.date_ecriture >= p_from)
       AND (p_to IS NULL OR ec.date_ecriture <= p_to)
       AND (p_exercice_id IS NULL OR ec.exercice_id = p_exercice_id)
  ), a AS (
    SELECT l.num, min(l.lib) AS lib, sum(l.d) AS d, sum(l.c) AS c FROM l GROUP BY l.num
  )
  SELECT a.num, coalesce(pc.libelle, a.lib, ''), a.d, a.c, a.d - a.c
    FROM a LEFT JOIN public.plan_comptable pc ON pc.numero = a.num
   ORDER BY 1;
END $$;
REVOKE ALL ON FUNCTION public.compta_balance(date, date, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.compta_balance(date, date, uuid) TO authenticated, service_role;

-- ─── 2. Balance d'un exercice à six colonnes (à-nouveaux calculés) ──────────
-- Ouverture : soldes cumulés des classes 1 à 5 à la veille de l'exercice. Les classes 6
-- à 8 des exercices antérieurs (résultats non affectés par écriture) sont regroupées sur
-- une ligne « 12 — Report à nouveau (calculé) », comme dans les états financiers.
-- Mouvements : écritures datées de l'exercice. Clôture : ouverture + mouvements.
CREATE OR REPLACE FUNCTION public.compta_balance_exercice(p_exercice_id uuid)
RETURNS TABLE(numero_compte text, libelle text, calcule boolean,
              ouverture_debit numeric, ouverture_credit numeric,
              mouvement_debit numeric, mouvement_credit numeric,
              solde_debit numeric, solde_credit numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_debut date; v_fin date;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'comptabilite.voir') THEN
    RAISE EXCEPTION 'Permission refusée : comptabilite.voir' USING ERRCODE = '42501';
  END IF;
  SELECT date_debut, date_fin INTO v_debut, v_fin
    FROM public.exercices_comptables WHERE exercice_id = p_exercice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exercice inconnu'; END IF;

  RETURN QUERY
  WITH l AS (
    SELECT coalesce(nullif(btrim(el.numero_compte), ''), pci.numero, '???') AS num,
           nullif(btrim(el.compte_libelle), '') AS lib,
           ec.date_ecriture < v_debut AS avant,
           coalesce(el.debit, 0) AS d, coalesce(el.credit, 0) AS c
      FROM public.ecriture_lignes el
      JOIN public.ecritures_comptables ec ON ec.ecriture_id = el.ecriture_id
      LEFT JOIN public.plan_comptable pci ON pci.compte_id = el.compte_id
     WHERE ec.date_ecriture <= v_fin
  ), k AS (
    -- Antérieur en classes 6 à 8 : vers le report à nouveau calculé.
    SELECT CASE WHEN l.avant AND left(l.num, 1) IN ('6', '7', '8') THEN '12' ELSE l.num END AS num,
           CASE WHEN l.avant AND left(l.num, 1) IN ('6', '7', '8') THEN NULL ELSE l.lib END AS lib,
           l.avant AND left(l.num, 1) IN ('6', '7', '8') AS calc,
           l.avant, l.d, l.c
      FROM l
     WHERE NOT (l.avant AND left(l.num, 1) = '9')
  ), a AS (
    SELECT k.num, bool_and(k.calc) AS calc, min(k.lib) AS lib,
           sum(CASE WHEN k.avant THEN k.d - k.c ELSE 0 END) AS ouv,
           sum(CASE WHEN k.avant THEN 0 ELSE k.d END) AS md,
           sum(CASE WHEN k.avant THEN 0 ELSE k.c END) AS mc
      FROM k GROUP BY k.num
  )
  SELECT a.num,
         CASE WHEN a.calc THEN 'Report à nouveau (résultats antérieurs non affectés, calculé)'
              ELSE coalesce(pc.libelle, a.lib, '') END,
         a.calc,
         greatest(a.ouv, 0), greatest(-a.ouv, 0), a.md, a.mc,
         greatest(a.ouv + a.md - a.mc, 0), greatest(-(a.ouv + a.md - a.mc), 0)
    FROM a LEFT JOIN public.plan_comptable pc ON pc.numero = a.num
   WHERE a.ouv <> 0 OR a.md <> 0 OR a.mc <> 0
   ORDER BY 1;
END $$;
REVOKE ALL ON FUNCTION public.compta_balance_exercice(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.compta_balance_exercice(uuid) TO authenticated;

-- ─── 3. Neutraliser une écriture manuelle (déséquilibrée ou brouillon) ──────
-- Écriture inverse à la même date, dans le même exercice (encore ouvert), liée à
-- l'originale : la paire s'annule dans la balance et reste visible. Les écritures des
-- pièces (factures, paiements, achats, paie, retours) s'annulent par leur pièce.
CREATE OR REPLACE FUNCTION public.compta_neutraliser_ecriture(p_ecriture_id uuid, p_motif text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; v_cp uuid; v_d numeric; v_c numeric; v_n bigint;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'comptabilite.modifier') THEN
    RAISE EXCEPTION 'Permission refusée : comptabilite.modifier' USING ERRCODE = '42501';
  END IF;
  IF char_length(btrim(coalesce(p_motif, ''))) < 5 THEN
    RAISE EXCEPTION 'Motif obligatoire (5 caractères au moins)';
  END IF;
  SELECT * INTO e FROM public.ecritures_comptables WHERE ecriture_id = p_ecriture_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Écriture inconnue'; END IF;
  IF e.contrepassee_le IS NOT NULL OR e.contrepassation_de IS NOT NULL THEN
    RAISE EXCEPTION 'Écriture % déjà contre-passée, ou contre-passation elle-même', e.reference;
  END IF;
  IF coalesce(e.piece_ref, '') ~ '^(FACT|PAI|ACH|BUL|RET):' THEN
    RAISE EXCEPTION 'Écriture % générée par une pièce : annulez la pièce', e.reference;
  END IF;
  IF public._compta_exercice_clos(e.exercice_id) THEN
    RAISE EXCEPTION 'Écriture % : exercice clôturé', e.reference;
  END IF;
  SELECT coalesce(sum(debit), 0), coalesce(sum(credit), 0), count(*) INTO v_d, v_c, v_n
    FROM public.ecriture_lignes WHERE ecriture_id = e.ecriture_id;

  INSERT INTO public.ecritures_comptables
    (reference, journal_id, journal, date_ecriture, libelle, montant, montant_total, statut,
     piece_ref, source_type, source_id, contrepassation_de)
  VALUES
    ('CP-' || coalesce(e.reference, left(e.ecriture_id::text, 8)), e.journal_id, e.journal,
     e.date_ecriture, 'Neutralisation : ' || btrim(p_motif), e.montant, e.montant_total,
     -- L'inverse d'une écriture déséquilibrée l'est aussi : elle ne peut pas être validée.
     CASE WHEN v_n > 0 AND abs(v_d - v_c) <= 0.01 THEN 'valide' ELSE 'brouillon' END,
     'CONTREPASSATION:' || e.ecriture_id::text, e.source_type, e.source_id, e.ecriture_id)
  RETURNING ecriture_id INTO v_cp;
  INSERT INTO public.ecriture_lignes
    (ecriture_id, compte_id, numero_compte, compte, compte_libelle, libelle, debit, credit)
  SELECT v_cp, compte_id, numero_compte, compte, compte_libelle,
         'Neutralisation : ' || coalesce(libelle, ''), credit, debit
    FROM public.ecriture_lignes WHERE ecriture_id = e.ecriture_id;
  UPDATE public.ecritures_comptables
     SET contrepassee_le = now(), contrepassee_par = v_cp
   WHERE ecriture_id = e.ecriture_id;
  RETURN v_cp;
END $$;
REVOKE ALL ON FUNCTION public.compta_neutraliser_ecriture(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.compta_neutraliser_ecriture(uuid, text) TO authenticated;

-- Écriture neutralisée : la paire (originale + inverse) s'annule ; elle ne compte plus
-- comme déséquilibrée.
CREATE OR REPLACE FUNCTION public.compta_ecritures_desequilibrees()
RETURNS TABLE(ecriture_id uuid, reference text, date_ecriture date, libelle text, statut text,
              total_debit numeric, total_credit numeric, nb_lignes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.ecriture_id, e.reference, e.date_ecriture, e.libelle, e.statut,
         coalesce(sum(l.debit), 0), coalesce(sum(l.credit), 0), count(l.ligne_id)
    FROM public.ecritures_comptables e
    LEFT JOIN public.ecriture_lignes l ON l.ecriture_id = e.ecriture_id
   WHERE public.has_permission(auth.uid(), 'comptabilite.voir')
     AND e.contrepassee_le IS NULL AND e.contrepassation_de IS NULL
   GROUP BY e.ecriture_id
  HAVING abs(coalesce(sum(l.debit), 0) - coalesce(sum(l.credit), 0)) > 0.01 OR count(l.ligne_id) = 0
   ORDER BY e.date_ecriture DESC;
$$;
REVOKE ALL ON FUNCTION public.compta_ecritures_desequilibrees() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.compta_ecritures_desequilibrees() TO authenticated;

-- ─── 4. Soldes d'ouverture clients en double (lecture seule) ────────────────
-- Solde d'ouverture d'un client qui a des factures antérieures à l'exercice : l'état de
-- compte les reprend déjà. À examiner (reprise réelle de l'existant, ou report d'une
-- ancienne clôture) ; rien n'est supprimé automatiquement.
CREATE OR REPLACE FUNCTION public.compta_soldes_ouverture_doublons()
RETURNS TABLE(client_id uuid, client_nom text, exercice_id uuid, exercice text,
              montant numeric, factures_anterieures bigint, montant_factures_anterieures numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.client_id, c.nom, s.exercice_id, coalesce(x.code, x.libelle), s.montant,
         count(f.facture_id), coalesce(sum(f.montant_total), 0)
    FROM public.soldes_ouverture_clients s
    JOIN public.exercices_comptables x ON x.exercice_id = s.exercice_id
    LEFT JOIN public.clients c ON c.client_id = s.client_id
    JOIN public.factures f ON f.client_id = s.client_id AND f.date_facture < x.date_debut
   WHERE public.has_permission(auth.uid(), 'comptabilite.voir')
     AND s.montant <> 0
   GROUP BY s.client_id, c.nom, s.exercice_id, x.code, x.libelle, s.montant
   ORDER BY abs(s.montant) DESC;
$$;
REVOKE ALL ON FUNCTION public.compta_soldes_ouverture_doublons() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.compta_soldes_ouverture_doublons() TO authenticated;

-- ─── 5. Contrôles de clôture (interne) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public._compta_cloture_controles(p_exercice_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  x public.exercices_comptables%ROWTYPE;
  v_suiv public.exercices_comptables%ROWTYPE;
  b jsonb := '[]'::jsonb;
  n bigint;
  v_suivant_ok boolean := true;
  v_totaux record;
BEGIN
  SELECT * INTO x FROM public.exercices_comptables WHERE exercice_id = p_exercice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exercice introuvable'; END IF;

  IF x.statut IN ('cloture', 'archive') THEN
    b := b || jsonb_build_object('code', 'deja_cloture', 'severite', 'error', 'nombre', 1,
      'message', 'Cet exercice est déjà clôturé.');
  END IF;
  IF x.date_fin >= current_date THEN
    b := b || jsonb_build_object('code', 'exercice_non_termine', 'severite', 'error', 'nombre', 1,
      'message', format('L''exercice n''est pas terminé : il se termine le %s.', to_char(x.date_fin, 'DD/MM/YYYY')));
  END IF;

  SELECT count(*) INTO n FROM public.exercices_comptables
   WHERE date_fin < x.date_debut AND statut NOT IN ('cloture', 'archive');
  IF n > 0 THEN
    b := b || jsonb_build_object('code', 'precedent_ouvert', 'severite', 'error', 'nombre', n,
      'message', format('%s exercice(s) antérieur(s) non clôturé(s) : clôturez-les d''abord.', n));
  END IF;

  -- Écritures de la période (paires neutralisées exclues).
  SELECT count(*) INTO n FROM (
    SELECT e.ecriture_id
      FROM public.ecritures_comptables e
      LEFT JOIN public.ecriture_lignes l ON l.ecriture_id = e.ecriture_id
     WHERE e.date_ecriture BETWEEN x.date_debut AND x.date_fin
       AND e.contrepassee_le IS NULL AND e.contrepassation_de IS NULL
     GROUP BY e.ecriture_id
    HAVING abs(coalesce(sum(l.debit), 0) - coalesce(sum(l.credit), 0)) > 0.01 OR count(l.ligne_id) = 0
  ) d;
  IF n > 0 THEN
    b := b || jsonb_build_object('code', 'ecritures_desequilibrees', 'severite', 'error', 'nombre', n,
      'message', format('%s écriture(s) déséquilibrée(s) ou sans lignes : neutralisez-les puis ressaisissez-les (Audit comptable).', n));
  END IF;

  SELECT count(*) INTO n FROM public.ecritures_comptables e
   WHERE (e.date_ecriture BETWEEN x.date_debut AND x.date_fin
          AND e.exercice_id IS DISTINCT FROM x.exercice_id)
      OR (e.exercice_id = x.exercice_id
          AND (e.date_ecriture IS NULL OR e.date_ecriture NOT BETWEEN x.date_debut AND x.date_fin));
  IF n > 0 THEN
    b := b || jsonb_build_object('code', 'ecritures_hors_exercice', 'severite', 'error', 'nombre', n,
      'message', format('%s écriture(s) dont la date ne correspond pas à l''exercice rattaché : elles échapperaient au verrou de clôture.', n));
  END IF;

  -- Pièces de la période sans écriture active.
  SELECT count(*) INTO n FROM (
    SELECT 'FACT:' || f.facture_id::text AS p FROM public.factures f
     WHERE f.date_facture BETWEEN x.date_debut AND x.date_fin
       AND f.statut IS DISTINCT FROM 'annulee' AND coalesce(f.montant_total, 0) <> 0
    UNION ALL
    SELECT 'PAI:' || p.paiement_id::text FROM public.paiements p
     WHERE p.date_paiement BETWEEN x.date_debut AND x.date_fin
       AND p.statut = 'valide' AND coalesce(p.montant, 0) <> 0
    UNION ALL
    SELECT 'ACH:' || a.achat_id::text FROM public.achats a
     WHERE a.date_achat BETWEEN x.date_debut AND x.date_fin
       AND a.statut IN ('confirme', 'receptionne', 'paye') AND coalesce(a.montant, 0) <> 0
  ) pieces
   WHERE NOT EXISTS (SELECT 1 FROM public.ecritures_comptables e
                      WHERE e.piece_ref = pieces.p
                        AND e.contrepassee_le IS NULL AND e.contrepassation_de IS NULL);
  IF n > 0 THEN
    b := b || jsonb_build_object('code', 'pieces_non_comptabilisees', 'severite', 'error', 'nombre', n,
      'message', format('%s pièce(s) validée(s) de l''exercice sans écriture comptable (factures, paiements, achats).', n));
  END IF;

  SELECT count(*) INTO n FROM public.ecritures_comptables e
   WHERE e.date_ecriture BETWEEN x.date_debut AND x.date_fin
     AND NOT public._compta_statut_valide(e.statut)
     AND e.contrepassee_le IS NULL AND e.contrepassation_de IS NULL;
  IF n > 0 THEN
    b := b || jsonb_build_object('code', 'ecritures_brouillon', 'severite', 'warning', 'nombre', n,
      'message', format('%s écriture(s) équilibrée(s) au statut brouillon : déjà comptées dans la balance, elles deviendront définitives.', n));
  END IF;

  SELECT count(*) INTO n FROM public.soldes_ouverture_clients s
   WHERE s.exercice_id = x.exercice_id AND s.montant <> 0
     AND EXISTS (SELECT 1 FROM public.factures f
                  WHERE f.client_id = s.client_id AND f.date_facture < x.date_debut);
  IF n > 0 THEN
    b := b || jsonb_build_object('code', 'soldes_ouverture_doublons', 'severite', 'warning', 'nombre', n,
      'message', format('%s solde(s) d''ouverture client(s) font peut-être double emploi avec des factures antérieures (Audit comptable).', n));
  END IF;

  -- Exercice suivant : contigu, sinon créé à la clôture.
  SELECT * INTO v_suiv FROM public.exercices_comptables WHERE date_debut = x.date_fin + 1 LIMIT 1;
  IF v_suiv.exercice_id IS NULL AND EXISTS (SELECT 1 FROM public.exercices_comptables
                                         WHERE date_debut > x.date_fin) THEN
    v_suivant_ok := false;
    b := b || jsonb_build_object('code', 'exercice_suivant_non_contigu', 'severite', 'error', 'nombre', 1,
      'message', format('Aucun exercice ne commence le %s, mais un exercice plus tardif existe : corrigez les dates.',
                        to_char(x.date_fin + 1, 'DD/MM/YYYY')));
  ELSIF v_suiv.exercice_id IS NULL THEN
    b := b || jsonb_build_object('code', 'exercice_suivant_cree', 'severite', 'warning', 'nombre', 1,
      'message', format('L''exercice suivant (%s → %s) n''existe pas : il sera créé.',
                        to_char(x.date_fin + 1, 'DD/MM/YYYY'),
                        to_char((x.date_fin + 1 + interval '1 year' - interval '1 day')::date, 'DD/MM/YYYY')));
  END IF;

  SELECT coalesce(sum(l.debit), 0) AS d, coalesce(sum(l.credit), 0) AS c,
         coalesce(sum(CASE WHEN left(l.numero_compte, 1) = '7' THEN l.credit - l.debit END), 0) AS produits,
         coalesce(sum(CASE WHEN left(l.numero_compte, 1) = '6' THEN l.debit - l.credit END), 0) AS charges,
         coalesce(sum(CASE WHEN left(l.numero_compte, 1) IN ('6', '7', '8') THEN l.credit - l.debit END), 0) AS resultat,
         count(DISTINCT e.ecriture_id) AS nb
    INTO v_totaux
    FROM public.ecritures_comptables e
    JOIN public.ecriture_lignes l ON l.ecriture_id = e.ecriture_id
   WHERE e.date_ecriture BETWEEN x.date_debut AND x.date_fin;

  RETURN jsonb_build_object(
    'exercice', jsonb_build_object('exercice_id', x.exercice_id, 'code', coalesce(x.code, x.libelle),
                                   'date_debut', x.date_debut, 'date_fin', x.date_fin, 'statut', x.statut),
    'exercice_suivant', CASE WHEN v_suiv.exercice_id IS NOT NULL THEN
        jsonb_build_object('exercice_id', v_suiv.exercice_id, 'code', coalesce(v_suiv.code, v_suiv.libelle), 'a_creer', false)
      WHEN v_suivant_ok THEN
        jsonb_build_object('exercice_id', NULL, 'code', public._compta_libelle_suivant(x), 'a_creer', true)
      END,
    'comptes', jsonb_build_object(
      'nb_ecritures', v_totaux.nb,
      'total_debit', round(v_totaux.d, 2), 'total_credit', round(v_totaux.c, 2),
      'produits', round(v_totaux.produits, 2), 'charges', round(v_totaux.charges, 2),
      'resultat', round(v_totaux.resultat, 2)),
    'blocages', b,
    'peut_cloturer', NOT EXISTS (SELECT 1 FROM jsonb_array_elements(b) j WHERE j ->> 'severite' = 'error')
  );
END $$;
REVOKE ALL ON FUNCTION public._compta_cloture_controles(uuid) FROM public, anon, authenticated;

-- Libellé de l'exercice suivant : « 2026 » après « 2025 », sinon années de début et fin.
CREATE OR REPLACE FUNCTION public._compta_libelle_suivant(x public.exercices_comptables)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
           WHEN coalesce(x.code, x.libelle, '') ~ '^\d{4}$'
             THEN (coalesce(x.code, x.libelle)::int + 1)::text
           WHEN extract(year FROM x.date_fin + 1) = extract(year FROM x.date_fin + 365)
             THEN extract(year FROM x.date_fin + 1)::text
           ELSE extract(year FROM x.date_fin + 1)::text || '-' || extract(year FROM x.date_fin + 365)::text
         END;
$$;

-- ─── 6. Aperçu et exécution de la clôture ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.preview_cloture_exercice(_exercice_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_permission(auth.uid(), 'exercices.cloturer') THEN
    RAISE EXCEPTION 'Permission refusée : exercices.cloturer' USING ERRCODE = '42501';
  END IF;
  RETURN public._compta_cloture_controles(_exercice_id);
END $$;
REVOKE ALL ON FUNCTION public.preview_cloture_exercice(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.preview_cloture_exercice(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.executer_cloture_exercice(_exercice_id uuid, _activer_suivant boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  x public.exercices_comptables%ROWTYPE;
  v_ctrl jsonb;
  v_cible uuid;
  v_cree boolean := false;
  v_nb_fours int := 0;
  v_montant_fours numeric := 0;
  v_erreurs text;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'exercices.cloturer') THEN
    RAISE EXCEPTION 'Permission refusée : exercices.cloturer' USING ERRCODE = '42501';
  END IF;
  -- Verrou : deux clôtures simultanées du même exercice sont sérialisées.
  SELECT * INTO x FROM public.exercices_comptables WHERE exercice_id = _exercice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exercice introuvable'; END IF;

  v_ctrl := public._compta_cloture_controles(_exercice_id);
  IF NOT (v_ctrl ->> 'peut_cloturer')::boolean THEN
    SELECT string_agg(j ->> 'message', ' ') INTO v_erreurs
      FROM jsonb_array_elements(v_ctrl -> 'blocages') j WHERE j ->> 'severite' = 'error';
    RAISE EXCEPTION 'Clôture refusée : %', v_erreurs USING ERRCODE = 'check_violation';
  END IF;

  v_cible := nullif(v_ctrl #>> '{exercice_suivant,exercice_id}', '')::uuid;
  IF v_cible IS NULL THEN
    INSERT INTO public.exercices_comptables (libelle, code, date_debut, date_fin, statut, is_actif)
    VALUES (v_ctrl #>> '{exercice_suivant,code}', v_ctrl #>> '{exercice_suivant,code}',
            x.date_fin + 1, (x.date_fin + 1 + interval '1 year' - interval '1 day')::date,
            CASE WHEN _activer_suivant THEN 'actif' ELSE 'preparation' END, false)
    RETURNING exercice_id INTO v_cible;
    v_cree := true;
  END IF;

  -- Fournisseurs : achats confirmés non payés à la date de clôture (tous exercices),
  -- reportés sur l'exercice suivant, dont le solde se calcule à partir de ce report.
  -- Clients : aucun report (l'état de compte reprend toutes les factures).
  WITH dus AS (
    SELECT a.fournisseur_id, sum(a.montant) AS montant
      FROM public.achats a
     WHERE a.fournisseur_id IS NOT NULL AND a.date_achat <= x.date_fin
       AND a.statut IN ('confirme', 'receptionne')
     GROUP BY a.fournisseur_id
    HAVING sum(a.montant) <> 0
  ), maj AS (
    -- Clôture après réouverture : le report est recalculé, pas ajouté une seconde fois.
    UPDATE public.soldes_ouverture_fournisseurs s SET montant = dus.montant, updated_at = now()
      FROM dus WHERE s.fournisseur_id = dus.fournisseur_id AND s.exercice_id = v_cible
  ), ins AS (
    INSERT INTO public.soldes_ouverture_fournisseurs (fournisseur_id, exercice_id, montant)
    SELECT dus.fournisseur_id, v_cible, dus.montant FROM dus
     WHERE NOT EXISTS (SELECT 1 FROM public.soldes_ouverture_fournisseurs s
                        WHERE s.fournisseur_id = dus.fournisseur_id AND s.exercice_id = v_cible)
  )
  SELECT count(*), coalesce(sum(montant), 0) INTO v_nb_fours, v_montant_fours FROM dus;

  UPDATE public.exercices_comptables
     SET statut = 'cloture', cloture_le = now(), is_actif = false, updated_at = now()
   WHERE exercice_id = _exercice_id;

  IF _activer_suivant THEN
    UPDATE public.exercices_comptables SET is_actif = false WHERE is_actif AND exercice_id <> v_cible;
    UPDATE public.exercices_comptables
       SET is_actif = true, statut = 'actif', updated_at = now()
     WHERE exercice_id = v_cible;
  END IF;

  INSERT INTO public.exercice_cloture_journal (
    exercice_source_id, exercice_cible_id, date_cloture, cloture_par,
    nb_clients_reportes, montant_total_clients,
    nb_fournisseurs_reportes, montant_total_fournisseurs, details
  ) VALUES (
    _exercice_id, v_cible, now(),
    coalesce((SELECT email FROM auth.users WHERE id = auth.uid()), auth.uid()::text),
    0, 0, v_nb_fours, v_montant_fours,
    jsonb_build_object('activer_suivant', _activer_suivant, 'exercice_suivant_cree', v_cree,
                       'comptes', v_ctrl -> 'comptes', 'avertissements', v_ctrl -> 'blocages')
  );

  RETURN jsonb_build_object(
    'exercice_source_id', _exercice_id,
    'exercice_cible_id', v_cible,
    'exercice_suivant_cree', v_cree,
    'resultat', v_ctrl #> '{comptes,resultat}',
    'nb_clients_reportes', 0,
    'montant_total_clients', 0,
    'nb_fournisseurs_reportes', v_nb_fours,
    'montant_total_fournisseurs', v_montant_fours
  );
END $$;
REVOKE ALL ON FUNCTION public.executer_cloture_exercice(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.executer_cloture_exercice(uuid, boolean) TO authenticated;

-- ─── 7. Contrôle global (0111) : écritures neutralisées exclues ─────────────
-- Repris de 0111 à l’identique, sauf le filtre sur les paires neutralisées.
CREATE OR REPLACE FUNCTION public.controle_integrite_global()
RETURNS TABLE(domaine text, anomalie text, piece text, reference text,
              montant_piece numeric, montant_ecritures numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_permission(auth.uid(), 'comptabilite.voir') THEN
    RAISE EXCEPTION 'Permission refusée : comptabilite.voir' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH ecr AS (
    -- Écritures actives des pièces générées, total au débit des lignes.
    SELECT split_part(e.piece_ref, ':', 1) AS type_piece,
           split_part(e.piece_ref, ':', 2)::uuid AS piece_id,
           count(*) AS nb,
           sum((SELECT coalesce(sum(l.debit), 0) FROM public.ecriture_lignes l
                 WHERE l.ecriture_id = e.ecriture_id)) AS total
      FROM public.ecritures_comptables e
     WHERE e.piece_ref ~ '^(FACT|PAI|ACH|BUL|RET):[0-9a-f-]{36}$'
       AND e.contrepassee_le IS NULL AND e.contrepassation_de IS NULL
     GROUP BY 1, 2
  ), src AS (
    SELECT 'FACT'::text AS type_piece, f.facture_id AS piece_id, f.reference, f.montant_total AS montant,
           (f.statut IS DISTINCT FROM 'annulee' AND coalesce(f.montant_total, 0) <> 0) AS doit
      FROM public.factures f
    UNION ALL
    SELECT 'PAI', p.paiement_id, p.reference, p.montant,
           (p.statut = 'valide' AND coalesce(p.montant, 0) <> 0)
      FROM public.paiements p
    UNION ALL
    SELECT 'ACH', a.achat_id, a.reference, a.montant,
           (a.statut IN ('confirme', 'receptionne', 'paye') AND coalesce(a.montant, 0) <> 0)
      FROM public.achats a
  ), j AS (
    SELECT coalesce(s.type_piece, ecr.type_piece) AS type_piece,
           coalesce(s.piece_id, ecr.piece_id) AS piece_id,
           s.reference, s.montant, coalesce(s.doit, false) AS doit, s.piece_id IS NULL AS absente,
           ecr.nb, ecr.total
      FROM src s
      FULL JOIN (SELECT * FROM ecr WHERE ecr.type_piece IN ('FACT', 'PAI', 'ACH')) ecr
        ON ecr.type_piece = s.type_piece AND ecr.piece_id = s.piece_id
  )
  SELECT CASE j.type_piece WHEN 'ACH' THEN 'Achats' ELSE 'Ventes et encaissements' END,
         CASE
           WHEN j.absente THEN 'Écriture active d''une pièce supprimée'
           WHEN j.doit AND j.nb IS NULL THEN 'Pièce validée sans écriture'
           WHEN NOT j.doit AND j.nb IS NOT NULL THEN 'Écriture active d''une pièce annulée ou non validée'
           WHEN j.nb > 1 THEN 'Pièce comptabilisée plusieurs fois'
           ELSE 'Écriture ≠ pièce'
         END,
         j.type_piece || ':' || j.piece_id::text, j.reference, j.montant, j.total
    FROM j
   WHERE j.absente
      OR (j.doit AND j.nb IS NULL)
      OR (NOT j.doit AND j.nb IS NOT NULL)
      OR (j.doit AND (j.nb > 1 OR round(j.total) <> round(j.montant)))

  UNION ALL
  SELECT 'Comptabilité',
         CASE WHEN d.nb_lignes = 0 THEN 'Écriture sans lignes' ELSE 'Écriture déséquilibrée' END,
         coalesce(d.piece_ref, d.ecriture_id::text), d.reference, d.total_debit, d.total_credit
    FROM (
      SELECT e.ecriture_id, e.piece_ref, e.reference,
             count(l.ecriture_id) AS nb_lignes,
             coalesce(sum(l.debit), 0) AS total_debit, coalesce(sum(l.credit), 0) AS total_credit
        FROM public.ecritures_comptables e
        LEFT JOIN public.ecriture_lignes l ON l.ecriture_id = e.ecriture_id
       WHERE e.contrepassee_le IS NULL AND e.contrepassation_de IS NULL
       GROUP BY e.ecriture_id, e.piece_ref, e.reference
    ) d
   WHERE d.nb_lignes = 0 OR round(d.total_debit, 2) <> round(d.total_credit, 2)

  UNION ALL
  SELECT 'Paie', c.anomalie, 'BUL:' || c.bulletin_id::text, c.reference,
         c.montant_bulletin, c.montant_ecritures
    FROM public.paie_controle_ecarts() c

  UNION ALL
  SELECT 'Finances', 'Transaction « salaire » à rapprocher des bulletins (double comptage possible)',
         'TRX:' || t.transaction_id::text, t.reference, t.montant, NULL::numeric
    FROM public.transactions t
   WHERE t.statut = 'valide' AND lower(coalesce(t.categorie, '')) IN ('salaire', 'salaires');
END $$;
REVOKE ALL ON FUNCTION public.controle_integrite_global() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.controle_integrite_global() TO authenticated;
