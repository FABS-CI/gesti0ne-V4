-- Intégrité des écritures comptables (audit du module Comptabilité).
--
-- Constats, établis sur les migrations et les types générés depuis la base :
--   1. Les écritures de l'ERP sont au statut « valide » (générateurs, _ecriture_sync),
--      mais guard_ecriture_balance / guard_ecriture_validate ne testaient que
--      « validee » : l'égalité débit = crédit n'était imposée sur aucune écriture.
--   2. Les garde-fous (24 h, exercice clôturé) ne portaient que sur l'en-tête : les
--      lignes, qui portent les montants, restaient modifiables sans limite.
--   3. Le verrou d'exercice clôturé lisait le statut dans le type exercice_statut,
--      absent de la base (statut texte « ouvert », « actif », « cloture ») : il ne
--      pouvait pas fonctionner.
--   4. Annuler une facture, modifier son montant ou dé-valider un paiement / un achat
--      SUPPRIMAIT l'écriture (_delete_ecriture_piece) au lieu de la contre-passer.
--   5. La saisie manuelle créait l'en-tête puis les lignes en deux requêtes : un échec
--      de la seconde laissait un en-tête sans lignes ; l'équilibre n'était vérifié que
--      dans le navigateur.
--
-- La base réelle ne correspond pas à un rejeu linéaire des migrations (tables
-- recréées) : chaque garde-fou est donc redéfini et rattaché de façon idempotente.

-- ─── Colonnes de contre-passation ───────────────────────────────────────────
ALTER TABLE public.ecritures_comptables
  ADD COLUMN IF NOT EXISTS contrepassee_le timestamptz,
  ADD COLUMN IF NOT EXISTS contrepassee_par uuid,
  ADD COLUMN IF NOT EXISTS contrepassation_de uuid;
COMMENT ON COLUMN public.ecritures_comptables.contrepassee_par IS
  'Écriture de contre-passation qui annule celle-ci (annulation de la pièce).';
COMMENT ON COLUMN public.ecritures_comptables.contrepassation_de IS
  'Sur une contre-passation : écriture annulée.';

-- Statut validé : « valide » (valeur réelle) ou « validee » (ancienne valeur).
CREATE OR REPLACE FUNCTION public._compta_statut_valide(_statut text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(_statut, '') IN ('valide', 'validee');
$$;

-- Exercice clôturé ou archivé (statut texte d'exercices_comptables).
CREATE OR REPLACE FUNCTION public._compta_exercice_clos(_exercice_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.exercices_comptables
                  WHERE exercice_id = _exercice_id AND statut IN ('cloture', 'archive'));
$$;

-- Contexte technique (rôle service, migrations, tâches planifiées) : non bridé.
CREATE OR REPLACE FUNCTION public._compta_contexte_technique()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT CASE
           WHEN coalesce(current_setting('request.jwt.claims', true), '') = '' THEN true
           ELSE (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
         END;
$$;

-- Mise à jour qui ne fait que marquer l'écriture comme contre-passée.
CREATE OR REPLACE FUNCTION public._compta_maj_contrepassation_seule(
  _old public.ecritures_comptables, _new public.ecritures_comptables)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT _old.contrepassee_le IS NULL AND _new.contrepassee_le IS NOT NULL
     AND (to_jsonb(_new) - 'contrepassee_le' - 'contrepassee_par' - 'piece_ref' - 'updated_at')
       = (to_jsonb(_old) - 'contrepassee_le' - 'contrepassee_par' - 'piece_ref' - 'updated_at');
$$;

-- ─── 1. Équilibre débit = crédit ────────────────────────────────────────────
-- Contrôlé à la fin de la transaction (contrainte différée) : une écriture peut être
-- construite ligne par ligne dans une même transaction.
CREATE OR REPLACE FUNCTION public.guard_ecriture_balance()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_id uuid; v_debit numeric; v_credit numeric;
BEGIN
  v_id := coalesce(NEW.ecriture_id, OLD.ecriture_id);
  IF v_id IS NULL THEN RETURN NULL; END IF;
  SELECT coalesce(sum(debit), 0), coalesce(sum(credit), 0) INTO v_debit, v_credit
    FROM public.ecriture_lignes WHERE ecriture_id = v_id;
  IF EXISTS (SELECT 1 FROM public.ecritures_comptables
              WHERE ecriture_id = v_id AND public._compta_statut_valide(statut))
     AND abs(v_debit - v_credit) > 0.01 THEN
    RAISE EXCEPTION 'Écriture déséquilibrée : débit % ≠ crédit %', v_debit, v_credit
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_guard_ecriture_balance ON public.ecriture_lignes;
CREATE CONSTRAINT TRIGGER trg_guard_ecriture_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.ecriture_lignes
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.guard_ecriture_balance();

-- Passage d'un brouillon au statut validé : écriture équilibrée et non vide.
CREATE OR REPLACE FUNCTION public.guard_ecriture_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_debit numeric; v_credit numeric;
BEGIN
  IF TG_OP = 'UPDATE' AND NOT public._compta_statut_valide(OLD.statut)
     AND public._compta_statut_valide(NEW.statut) THEN
    SELECT coalesce(sum(debit), 0), coalesce(sum(credit), 0) INTO v_debit, v_credit
      FROM public.ecriture_lignes WHERE ecriture_id = NEW.ecriture_id;
    IF abs(v_debit - v_credit) > 0.01 OR v_debit = 0 THEN
      RAISE EXCEPTION 'Validation impossible : écriture vide ou déséquilibrée (débit % / crédit %)',
        v_debit, v_credit USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_ecriture_validate ON public.ecritures_comptables;
CREATE TRIGGER trg_guard_ecriture_validate BEFORE UPDATE ON public.ecritures_comptables
  FOR EACH ROW EXECUTE FUNCTION public.guard_ecriture_validate();

-- ─── 2. En-tête : pas de suppression, pas de modification après 24 h ni en
--        exercice clôturé (sauf marquage de contre-passation) ──────────────────
CREATE OR REPLACE FUNCTION public.trg_ecritures_no_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF public._compta_contexte_technique() THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Suppression interdite : l''écriture % doit être contre-passée, pas supprimée',
    OLD.reference USING ERRCODE = 'insufficient_privilege';
END $$;
DROP TRIGGER IF EXISTS trg_ecritures_no_delete ON public.ecritures_comptables;
CREATE TRIGGER trg_ecritures_no_delete BEFORE DELETE ON public.ecritures_comptables
  FOR EACH ROW EXECUTE FUNCTION public.trg_ecritures_no_delete();

CREATE OR REPLACE FUNCTION public.trg_ecritures_no_modif_ancienne()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF public._compta_contexte_technique() OR public._compta_maj_contrepassation_seule(OLD, NEW) THEN
    RETURN NEW;
  END IF;
  IF public._compta_exercice_clos(OLD.exercice_id) OR public._compta_exercice_clos(NEW.exercice_id) THEN
    RAISE EXCEPTION 'Modification interdite : l''écriture % appartient à un exercice clôturé',
      OLD.reference USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.created_at < now() - interval '24 hours' THEN
    RAISE EXCEPTION 'Modification interdite : l''écriture % a plus de 24 h (la contre-passer)',
      OLD.reference USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_ecritures_no_modif_ancienne ON public.ecritures_comptables;
CREATE TRIGGER trg_ecritures_no_modif_ancienne BEFORE UPDATE ON public.ecritures_comptables
  FOR EACH ROW EXECUTE FUNCTION public.trg_ecritures_no_modif_ancienne();

-- Nouvelle écriture dans un exercice clôturé : refusée.
CREATE OR REPLACE FUNCTION public.trg_ecritures_exercice_ouvert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT public._compta_contexte_technique() AND public._compta_exercice_clos(NEW.exercice_id) THEN
    RAISE EXCEPTION 'Écriture refusée : l''exercice du % est clôturé', NEW.date_ecriture
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
-- Après trg_ecriture_sync (ordre alphabétique) : exercice_id déjà résolu depuis la date.
DROP TRIGGER IF EXISTS trg_ecritures_zz_exercice_ouvert ON public.ecritures_comptables;
CREATE TRIGGER trg_ecritures_zz_exercice_ouvert BEFORE INSERT ON public.ecritures_comptables
  FOR EACH ROW EXECUTE FUNCTION public.trg_ecritures_exercice_ouvert();

-- ─── 3. Lignes : mêmes verrous que leur en-tête ─────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_ecriture_lignes_verrou()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE e record;
BEGIN
  IF public._compta_contexte_technique() THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  SELECT reference, created_at, exercice_id, contrepassee_le INTO e
    FROM public.ecritures_comptables
   WHERE ecriture_id = CASE WHEN TG_OP = 'DELETE' THEN OLD.ecriture_id ELSE NEW.ecriture_id END;
  IF FOUND THEN
    IF public._compta_exercice_clos(e.exercice_id) THEN
      RAISE EXCEPTION 'Lignes verrouillées : l''écriture % appartient à un exercice clôturé',
        e.reference USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF e.contrepassee_le IS NOT NULL OR e.created_at < now() - interval '24 hours' THEN
      RAISE EXCEPTION 'Lignes verrouillées : l''écriture % est contre-passée ou a plus de 24 h',
        e.reference USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS trg_ecriture_lignes_verrou ON public.ecriture_lignes;
CREATE TRIGGER trg_ecriture_lignes_verrou BEFORE INSERT OR UPDATE OR DELETE ON public.ecriture_lignes
  FOR EACH ROW EXECUTE FUNCTION public.trg_ecriture_lignes_verrou();

-- ─── 4. Annulation d'une pièce : contre-passation, jamais de suppression ────
-- Appelée par les déclencheurs des factures, paiements et achats (annulation,
-- changement de montant, dé-validation). Pour chaque écriture active de la pièce :
-- écriture inverse (débit ↔ crédit) datée du jour, puis marquage de l'originale.
-- L'originale quitte la référence de pièce (préfixe ANNULEE:) pour qu'une nouvelle
-- comptabilisation de la pièce reparte d'une écriture neuve ; le lien est conservé
-- dans contrepassee_par / contrepassation_de.
CREATE OR REPLACE FUNCTION public._delete_ecriture_piece(_piece text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; v_cp uuid;
BEGIN
  FOR e IN SELECT * FROM public.ecritures_comptables
            WHERE piece_ref = _piece AND contrepassee_le IS NULL AND contrepassation_de IS NULL
            ORDER BY created_at
            FOR UPDATE
  LOOP
    INSERT INTO public.ecritures_comptables
      (reference, journal_id, journal, date_ecriture, libelle, montant, montant_total, statut,
       piece_ref, source_type, source_id, contrepassation_de)
    VALUES
      ('CP-' || coalesce(e.reference, left(e.ecriture_id::text, 8)), e.journal_id, e.journal,
       greatest(current_date, e.date_ecriture), 'Contre-passation : ' || coalesce(e.libelle, ''),
       e.montant, e.montant_total, 'valide',
       'CONTREPASSATION:' || e.ecriture_id::text || ':' || _piece, e.source_type, e.source_id,
       e.ecriture_id)
    RETURNING ecriture_id INTO v_cp;
    INSERT INTO public.ecriture_lignes
      (ecriture_id, compte_id, numero_compte, compte, compte_libelle, libelle, debit, credit)
    SELECT v_cp, compte_id, numero_compte, compte, compte_libelle,
           'Contre-passation : ' || coalesce(libelle, ''), credit, debit
      FROM public.ecriture_lignes WHERE ecriture_id = e.ecriture_id;
    UPDATE public.ecritures_comptables
       SET contrepassee_le = now(), contrepassee_par = v_cp,
           piece_ref = 'ANNULEE:' || e.ecriture_id::text || ':' || _piece
     WHERE ecriture_id = e.ecriture_id;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public._delete_ecriture_piece(text) FROM public, anon, authenticated;

-- ─── 5. Saisie manuelle atomique ────────────────────────────────────────────
-- p_lignes : [{ "compte": "601", "compte_libelle": "Achats", "debit": 1000, "credit": 0 }]
CREATE OR REPLACE FUNCTION public.compta_saisir_ecriture(
  p_date date, p_journal text, p_reference text, p_libelle text, p_lignes jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_n int; v_debit numeric; v_credit numeric; v_ref text; v_bad text;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'comptabilite.creer') THEN
    RAISE EXCEPTION 'Permission refusée : comptabilite.creer' USING ERRCODE = '42501';
  END IF;
  IF coalesce(btrim(p_libelle), '') = '' THEN RAISE EXCEPTION 'Libellé requis'; END IF;
  IF p_date IS NULL THEN RAISE EXCEPTION 'Date requise'; END IF;
  IF jsonb_typeof(p_lignes) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Lignes invalides'; END IF;

  DROP TABLE IF EXISTS _lignes;
  CREATE TEMP TABLE _lignes ON COMMIT DROP AS
    SELECT btrim(l.compte) AS compte, nullif(btrim(l.compte_libelle), '') AS compte_libelle,
           round(coalesce(l.debit, 0), 2) AS debit, round(coalesce(l.credit, 0), 2) AS credit
      FROM jsonb_to_recordset(p_lignes) AS l(compte text, compte_libelle text, debit numeric, credit numeric)
     WHERE coalesce(btrim(l.compte), '') <> '' AND (coalesce(l.debit, 0) <> 0 OR coalesce(l.credit, 0) <> 0);

  SELECT compte INTO v_bad FROM _lignes
   WHERE debit < 0 OR credit < 0 OR (debit > 0 AND credit > 0) OR compte !~ '^[1-9]' LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Ligne invalide (compte %) : montants positifs, débit OU crédit, compte commençant par sa classe (1 à 9)', v_bad;
  END IF;
  SELECT count(*), coalesce(sum(debit), 0), coalesce(sum(credit), 0) INTO v_n, v_debit, v_credit FROM _lignes;
  IF v_n < 2 THEN RAISE EXCEPTION 'Au moins 2 lignes valides sont requises'; END IF;
  IF v_debit <> v_credit THEN
    RAISE EXCEPTION 'Écriture déséquilibrée : débit % ≠ crédit %', v_debit, v_credit;
  END IF;

  v_ref := coalesce(nullif(btrim(p_reference), ''),
                    coalesce(nullif(btrim(p_journal), ''), 'OD') || '-' || to_char(clock_timestamp(), 'YYMMDDHH24MISSMS'));
  INSERT INTO public.ecritures_comptables
    (date_ecriture, journal, journal_id, reference, libelle, montant, montant_total, statut, source_type)
  VALUES (p_date, coalesce(nullif(btrim(p_journal), ''), 'OD'), public._journal_id(coalesce(nullif(btrim(p_journal), ''), 'OD')),
          v_ref, btrim(p_libelle), v_debit, v_debit, 'valide', 'manuel')
  RETURNING ecriture_id INTO v_id;
  INSERT INTO public.ecriture_lignes (ecriture_id, compte, numero_compte, compte_libelle, libelle, debit, credit)
    SELECT v_id, compte, compte, coalesce(compte_libelle, compte), coalesce(compte_libelle, compte), debit, credit
      FROM _lignes;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.compta_saisir_ecriture(date, text, text, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.compta_saisir_ecriture(date, text, text, text, jsonb) TO authenticated;

-- ─── Contrôle : écritures déséquilibrées ou vides déjà enregistrées ─────────
-- Lecture seule (comptabilite.voir). La balance (compta_balance) additionne toutes
-- les écritures quel que soit leur statut ; les saisies manuelles d'avant 0108 sont au
-- statut « brouillon » (défaut de la colonne) sans contrôle d'équilibre : le contrôle
-- liste donc tout ce que la balance compte, avec le statut. Les en-têtes sans ligne
-- (saisie interrompue entre l'en-tête et les lignes) sont aussi signalés.
-- À corriger par contre-passation ; les garde-fous ci-dessus empêchent d'en créer.
CREATE OR REPLACE FUNCTION public.compta_ecritures_desequilibrees()
RETURNS TABLE(ecriture_id uuid, reference text, date_ecriture date, libelle text, statut text,
              total_debit numeric, total_credit numeric, nb_lignes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.ecriture_id, e.reference, e.date_ecriture, e.libelle, e.statut,
         coalesce(sum(l.debit), 0), coalesce(sum(l.credit), 0), count(l.ligne_id)
    FROM public.ecritures_comptables e
    LEFT JOIN public.ecriture_lignes l ON l.ecriture_id = e.ecriture_id
   WHERE public.has_permission(auth.uid(), 'comptabilite.voir')
   GROUP BY e.ecriture_id
  HAVING abs(coalesce(sum(l.debit), 0) - coalesce(sum(l.credit), 0)) > 0.01 OR count(l.ligne_id) = 0
   ORDER BY e.date_ecriture DESC;
$$;
REVOKE ALL ON FUNCTION public.compta_ecritures_desequilibrees() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.compta_ecritures_desequilibrees() TO authenticated;

-- ─── 6. Exercice clôturé : réouverture tracée uniquement ────────────────────
-- La modification d'un exercice (écran Exercices) écrivait statut et dates sans
-- contrôle : un exercice clôturé pouvait être rouvert ou redaté sans motif ni trace.
-- Désormais, statut et dates d'un exercice clôturé ou archivé ne changent que par
-- compta_rouvrir_exercice (droit exercices.cloturer, motif, journal).
CREATE TABLE IF NOT EXISTS public.exercices_reouvertures (
  reouverture_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercice_id uuid NOT NULL REFERENCES public.exercices_comptables(exercice_id) ON DELETE RESTRICT,
  ancien_statut text NOT NULL,
  motif text NOT NULL,
  rouvert_par uuid DEFAULT auth.uid(),
  rouvert_le timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.exercices_reouvertures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exercices_reouvertures FROM anon, authenticated;
GRANT SELECT ON public.exercices_reouvertures TO authenticated;
DROP POLICY IF EXISTS exercices_reouvertures_read ON public.exercices_reouvertures;
CREATE POLICY exercices_reouvertures_read ON public.exercices_reouvertures FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'comptabilite.voir'));

CREATE OR REPLACE FUNCTION public.trg_exercice_clos_protege()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.statut IN ('cloture', 'archive')
     AND (NEW.statut IS DISTINCT FROM OLD.statut OR NEW.date_debut IS DISTINCT FROM OLD.date_debut
          OR NEW.date_fin IS DISTINCT FROM OLD.date_fin)
     AND coalesce(current_setting('compta.reouverture', true), '') <> 'on'
     AND NOT public._compta_contexte_technique() THEN
    RAISE EXCEPTION 'Exercice clôturé : statut et dates ne changent que par une réouverture motivée'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_exercice_clos_protege ON public.exercices_comptables;
CREATE TRIGGER trg_exercice_clos_protege BEFORE UPDATE ON public.exercices_comptables
  FOR EACH ROW EXECUTE FUNCTION public.trg_exercice_clos_protege();

CREATE OR REPLACE FUNCTION public.compta_rouvrir_exercice(p_exercice_id uuid, p_motif text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_statut text;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'exercices.cloturer') THEN
    RAISE EXCEPTION 'Permission refusée : exercices.cloturer' USING ERRCODE = '42501';
  END IF;
  IF char_length(btrim(coalesce(p_motif, ''))) < 5 THEN
    RAISE EXCEPTION 'Motif de réouverture obligatoire';
  END IF;
  SELECT statut INTO v_statut FROM public.exercices_comptables
   WHERE exercice_id = p_exercice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exercice inconnu'; END IF;
  IF v_statut NOT IN ('cloture', 'archive') THEN
    RAISE EXCEPTION 'Cet exercice n''est pas clôturé (statut %)', v_statut;
  END IF;
  PERFORM set_config('compta.reouverture', 'on', true);
  UPDATE public.exercices_comptables
     -- « actif » : statut connu de l'écran ; l'exercice courant (is_actif) ne change pas.
     SET statut = 'actif', cloture_le = NULL, updated_at = now()
   WHERE exercice_id = p_exercice_id;
  PERFORM set_config('compta.reouverture', '', true);
  INSERT INTO public.exercices_reouvertures (exercice_id, ancien_statut, motif)
    VALUES (p_exercice_id, v_statut, btrim(p_motif));
END $$;
REVOKE ALL ON FUNCTION public.compta_rouvrir_exercice(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.compta_rouvrir_exercice(uuid, text) TO authenticated;
