-- Intégrité de la paie (audit du module Ressources humaines).
--
-- Constats :
--   1. Un bulletin validé (déjà comptabilisé, pièce BUL:<id>) restait modifiable et
--      supprimable par l'écran générique des bulletins et par l'API (RLS « FOR ALL ») :
--      net, brut ou retenues changés sans nouvelle écriture, bulletin supprimé alors que
--      son écriture reste au journal ; lignes du bulletin modifiables.
--   2. Le statut « valide » pouvait être posé directement (sans paie_valider_bulletin).
--   3. Aucun moyen d'annuler un bulletin validé de façon tracée : l'unicité
--      (employé, date_debut, date_fin) empêchait aussi de le refaire.
--   4. Périodes qui se chevauchent acceptées pour un même employé (double paie).
--   5. Aucun contrôle des écarts entre bulletins validés et écritures comptables.
-- Corrections idempotentes (la base réelle ne suit pas un rejeu linéaire des migrations).

ALTER TABLE public.bulletins_paie ADD COLUMN IF NOT EXISTS annule_le timestamptz;
ALTER TABLE public.bulletins_paie ADD COLUMN IF NOT EXISTS annule_par uuid;
ALTER TABLE public.bulletins_paie ADD COLUMN IF NOT EXISTS motif_annulation text;

-- Opérations de paie autorisées à changer le statut : variable de transaction posée
-- par les RPC (validation, annulation), jamais par le client.
CREATE OR REPLACE FUNCTION public._paie_operation() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('paie.operation', true), '');
$$;

-- ─── 1. Verrou des bulletins ────────────────────────────────────────────────
-- Brouillon / généré : supprimable ; montants et lignes ne changent que par la RPC
--   (pour corriger : supprimer puis recalculer).
-- Validé : seul le passage à « paye » (avec date et mode de paiement) ou l'annulation
--   par paie_annuler_bulletin. Payé : date, mode de paiement et PDF seulement.
-- Annulé : figé.
CREATE OR REPLACE FUNCTION public.trg_bulletins_paie_verrou()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  libres text[] := ARRAY['date_paiement', 'mode_paiement', 'pdf_url', 'updated_at', 'statut'];
BEGIN
  IF public._compta_contexte_technique() THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF coalesce(OLD.statut, 'brouillon') IN ('brouillon', 'genere') THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Bulletin % (%) : suppression interdite, l''annuler', OLD.reference, OLD.statut
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF OLD.statut = 'annule' THEN
    RAISE EXCEPTION 'Bulletin % annulé : il ne se modifie plus', OLD.reference
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.statut IS DISTINCT FROM OLD.statut THEN
    IF NEW.statut = 'valide' AND public._paie_operation() <> 'validation' THEN
      RAISE EXCEPTION 'Bulletin % : la validation passe par « Valider »', OLD.reference
        USING ERRCODE = 'insufficient_privilege';
    ELSIF NEW.statut = 'annule' AND public._paie_operation() <> 'annulation' THEN
      RAISE EXCEPTION 'Bulletin % : l''annulation passe par « Annuler » (motif requis)', OLD.reference
        USING ERRCODE = 'insufficient_privilege';
    ELSIF NEW.statut = 'paye' AND OLD.statut <> 'valide' THEN
      RAISE EXCEPTION 'Bulletin % : seul un bulletin validé peut être payé', OLD.reference
        USING ERRCODE = 'insufficient_privilege';
    ELSIF NEW.statut NOT IN ('valide', 'annule', 'paye') AND OLD.statut IN ('valide', 'paye') THEN
      RAISE EXCEPTION 'Bulletin % % : retour en arrière interdit, l''annuler', OLD.reference, OLD.statut
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  -- Montants, employé, période, lignes de calcul : fixés par paie_enregistrer_bulletin.
  IF public._paie_operation() <> 'annulation'
     AND (to_jsonb(NEW) - libres) IS DISTINCT FROM (to_jsonb(OLD) - libres) THEN
    RAISE EXCEPTION 'Bulletin % : montants, employé et période ne se modifient pas (supprimer le brouillon et recalculer, ou annuler le bulletin validé)',
      OLD.reference USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_bulletins_paie_verrou ON public.bulletins_paie;
CREATE TRIGGER trg_bulletins_paie_verrou BEFORE UPDATE OR DELETE ON public.bulletins_paie
  FOR EACH ROW EXECUTE FUNCTION public.trg_bulletins_paie_verrou();

-- Lignes : ajoutées par la RPC sur un brouillon ; jamais modifiées ; supprimées avec
-- leur brouillon (cascade : le bulletin n'existe alors plus).
CREATE OR REPLACE FUNCTION public.trg_bulletin_lignes_verrou()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_statut text; v_ref text; v_id uuid;
BEGIN
  IF public._compta_contexte_technique() THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  v_id := CASE WHEN TG_OP = 'INSERT' THEN NEW.bulletin_id ELSE OLD.bulletin_id END;
  SELECT coalesce(statut, 'brouillon'), reference INTO v_statut, v_ref
    FROM public.bulletins_paie WHERE bulletin_id = v_id;
  IF NOT FOUND THEN RETURN OLD; END IF;
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Bulletin % : les lignes ne se modifient pas (recalculer le bulletin)', v_ref
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_statut NOT IN ('brouillon', 'genere') THEN
    RAISE EXCEPTION 'Bulletin % % : lignes verrouillées', v_ref, v_statut
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS trg_bulletin_lignes_verrou ON public.bulletin_lignes;
CREATE TRIGGER trg_bulletin_lignes_verrou BEFORE INSERT OR UPDATE OR DELETE ON public.bulletin_lignes
  FOR EACH ROW EXECUTE FUNCTION public.trg_bulletin_lignes_verrou();

-- Écriture directe par les comptables (politique de juillet jamais retirée) : la
-- création passe par paie_enregistrer_bulletin, qui n'en a pas besoin. Lecture inchangée.
DROP POLICY IF EXISTS "paie write bulletins_paie" ON public.bulletins_paie;

-- ─── 2. Une seule paie par employé et par jour ──────────────────────────────
-- Unicité hors bulletins annulés (un bulletin annulé peut être refait).
DROP INDEX IF EXISTS public.bulletins_paie_employe_periode_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS bulletins_paie_employe_periode_actif_uniq
  ON public.bulletins_paie (employe_id, date_debut, date_fin)
  WHERE date_debut IS NOT NULL AND coalesce(statut, '') <> 'annule';

CREATE OR REPLACE FUNCTION public.trg_bulletins_paie_chevauchement()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_ref text;
BEGIN
  IF NEW.employe_id IS NULL OR NEW.date_debut IS NULL OR NEW.date_fin IS NULL
     OR coalesce(NEW.statut, '') = 'annule' THEN
    RETURN NEW;
  END IF;
  IF NEW.date_fin < NEW.date_debut THEN RAISE EXCEPTION 'Période invalide'; END IF;
  -- Sérialise les créations concurrentes pour un même employé.
  PERFORM pg_advisory_xact_lock(hashtext('bulletin:' || NEW.employe_id::text));
  SELECT reference INTO v_ref FROM public.bulletins_paie
   WHERE employe_id = NEW.employe_id AND bulletin_id <> NEW.bulletin_id
     AND coalesce(statut, '') <> 'annule'
     AND date_debut IS NOT NULL AND date_fin IS NOT NULL
     AND date_debut <= NEW.date_fin AND date_fin >= NEW.date_debut
   LIMIT 1;
  IF v_ref IS NOT NULL THEN
    RAISE EXCEPTION 'Un bulletin (%) couvre déjà tout ou partie de cette période pour cet employé', v_ref
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_bulletins_paie_chevauchement ON public.bulletins_paie;
CREATE TRIGGER trg_bulletins_paie_chevauchement BEFORE INSERT ON public.bulletins_paie
  FOR EACH ROW EXECUTE FUNCTION public.trg_bulletins_paie_chevauchement();

-- ─── 3. Validation et annulation ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.paie_valider_bulletin(p_bulletin_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (rbac3_can('rh.modifier', auth.uid()) OR is_hr(auth.uid())) THEN
    RAISE EXCEPTION 'Droit insuffisant pour valider un bulletin';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM bulletin_lignes WHERE bulletin_id = p_bulletin_id) THEN
    RAISE EXCEPTION 'Bulletin sans lignes de calcul : le recalculer avant validation';
  END IF;
  PERFORM set_config('paie.operation', 'validation', true);
  UPDATE bulletins_paie SET statut = 'valide', updated_at = now()
   WHERE bulletin_id = p_bulletin_id AND statut IN ('brouillon','genere');
  IF NOT FOUND THEN RAISE EXCEPTION 'Bulletin introuvable ou déjà validé'; END IF;
  PERFORM set_config('paie.operation', '', true);
END $$;

-- Un bulletin validé (non payé) s'annule avec un motif : son écriture est
-- contre-passée, le bulletin reste consultable et la période peut être refaite.
-- Un bulletin payé ne s'annule pas ici (le paiement devrait être repris d'abord).
CREATE OR REPLACE FUNCTION public.paie_annuler_bulletin(p_bulletin_id uuid, p_motif text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b record;
BEGIN
  IF NOT (rbac3_can('rh.modifier', auth.uid()) OR is_hr(auth.uid())) THEN
    RAISE EXCEPTION 'Droit insuffisant pour annuler un bulletin';
  END IF;
  IF length(btrim(coalesce(p_motif, ''))) < 5 THEN
    RAISE EXCEPTION 'Motif d''annulation requis (5 caractères au moins)';
  END IF;
  SELECT * INTO b FROM bulletins_paie WHERE bulletin_id = p_bulletin_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bulletin introuvable'; END IF;
  IF b.statut = 'paye' THEN
    RAISE EXCEPTION 'Bulletin % payé : annulation impossible ici, reprendre le paiement d''abord', b.reference;
  ELSIF b.statut IS DISTINCT FROM 'valide' THEN
    RAISE EXCEPTION 'Seul un bulletin validé s''annule (un brouillon se supprime)';
  END IF;
  PERFORM set_config('paie.operation', 'annulation', true);
  UPDATE bulletins_paie
     SET statut = 'annule', annule_le = now(), annule_par = auth.uid(),
         motif_annulation = btrim(p_motif), updated_at = now()
   WHERE bulletin_id = p_bulletin_id;
  PERFORM public._delete_ecriture_piece('BUL:' || p_bulletin_id::text);
  PERFORM set_config('paie.operation', '', true);
END $$;
REVOKE ALL ON FUNCTION public.paie_annuler_bulletin(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.paie_annuler_bulletin(uuid, text) TO authenticated;

-- ─── 4. Contrôle paie ↔ comptabilité (lecture seule) ───────────────────────
-- Bulletins validés ou payés sans écriture active, ou dont l'écriture ne correspond
-- plus (total, net au 422), écritures de bulletins supprimés ou non validés,
-- chevauchements existants.
-- Rien n'est généré ni corrigé automatiquement.
CREATE OR REPLACE FUNCTION public.paie_controle_ecarts()
RETURNS TABLE(anomalie text, bulletin_id uuid, reference text, employe_nom text,
              periode text, statut text, montant_bulletin numeric, montant_ecritures numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ecr AS (
    SELECT split_part(e.piece_ref, ':', 2)::uuid AS bulletin_id,
           count(*) AS nb, sum(e.montant) AS montant,
           sum((SELECT coalesce(sum(l.credit - l.debit), 0) FROM public.ecriture_lignes l
                 WHERE l.ecriture_id = e.ecriture_id AND l.compte = '422')) AS net_422
      FROM public.ecritures_comptables e
     WHERE e.piece_ref ~ '^BUL:[0-9a-f-]{36}$'
       AND e.contrepassee_le IS NULL AND e.contrepassation_de IS NULL
     GROUP BY 1
  ), b AS (
    SELECT bp.*, ecr.nb, ecr.montant AS montant_ecr, ecr.net_422,
           bp.salaire_brut + coalesce(bp.cotisations, 0) + greatest(coalesce(bp.arrondi, 0), 0) AS montant_attendu
      FROM public.bulletins_paie bp LEFT JOIN ecr ON ecr.bulletin_id = bp.bulletin_id
  )
  SELECT x.* FROM (
    SELECT 'Bulletin validé sans écriture'::text, b.bulletin_id, b.reference, b.employe_nom, b.periode,
           b.statut, b.montant_attendu, NULL::numeric
      FROM b WHERE b.statut IN ('valide', 'paye') AND b.nb IS NULL AND coalesce(b.salaire_brut, 0) > 0
    UNION ALL
    SELECT 'Écriture ≠ bulletin', b.bulletin_id, b.reference, b.employe_nom, b.periode,
           b.statut, b.montant_attendu, b.montant_ecr
      FROM b WHERE b.statut IN ('valide', 'paye') AND b.nb IS NOT NULL
       AND (b.nb > 1 OR round(b.montant_ecr) <> round(b.montant_attendu)
            OR round(b.net_422) <> round(coalesce(b.net_a_payer, 0)))
    UNION ALL
    SELECT 'Écriture d''un bulletin supprimé', ecr.bulletin_id, NULL, NULL, NULL, NULL, NULL, ecr.montant
      FROM ecr WHERE NOT EXISTS (SELECT 1 FROM public.bulletins_paie bp WHERE bp.bulletin_id = ecr.bulletin_id)
    UNION ALL
    SELECT 'Écriture active d''un bulletin non validé', b.bulletin_id, b.reference, b.employe_nom, b.periode,
           b.statut, b.montant_attendu, b.montant_ecr
      FROM b WHERE coalesce(b.statut, '') NOT IN ('valide', 'paye') AND b.nb IS NOT NULL
    UNION ALL
    SELECT 'Périodes qui se chevauchent', b.bulletin_id, b.reference, b.employe_nom, b.periode,
           b.statut, b.net_a_payer, NULL
      FROM b WHERE coalesce(b.statut, '') <> 'annule' AND b.date_debut IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.bulletins_paie o
                    WHERE o.employe_id = b.employe_id AND o.bulletin_id <> b.bulletin_id
                      AND coalesce(o.statut, '') <> 'annule' AND o.date_debut IS NOT NULL
                      AND o.date_debut <= b.date_fin AND o.date_fin >= b.date_debut)
  ) x(anomalie, bulletin_id, reference, employe_nom, periode, statut, montant_bulletin, montant_ecritures)
  WHERE public.has_permission(auth.uid(), 'comptabilite.voir') OR public.is_hr(auth.uid());
$$;
REVOKE ALL ON FUNCTION public.paie_controle_ecarts() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.paie_controle_ecarts() TO authenticated;
