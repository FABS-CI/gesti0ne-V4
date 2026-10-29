-- RH / Paie : bulletins validés figés, congés et absences sans chevauchement,
-- salariés non actifs signalés au moteur de paie.
--
-- 1. Un bulletin validé ou payé ne change plus : le formulaire générique « Paie » et
--    l'API permettaient de modifier brut, retenues et net, ou de supprimer le bulletin,
--    sans passer par le moteur. Restent modifiables : statut (valide → paye),
--    date_paiement, mode_paiement, pdf_url. Ses lignes ne peuvent plus être modifiées.
--    Les fonctions serveur (SECURITY DEFINER) et service_role (restauration) ne sont pas
--    concernées : le contrôle vise les appels directs des utilisateurs.
-- 2. Congés et absences : date de fin >= date de début (contrats aussi), et pas deux
--    demandes actives qui se chevauchent pour un même salarié. Contraintes NOT VALID :
--    les lignes existantes ne sont pas rejetées, seules les nouvelles saisies et les
--    modifications sont contrôlées (scripts/diagnostic-rh-paie.sql liste l'existant).
-- 3. Moteur : un salarié non actif (statut, fiche inactive ou archivée) ou entré / sorti
--    en cours de période produit une anomalie. La génération mensuelle les écarte ;
--    un bulletin individuel (régularisation, jours saisis) reste possible.

-- 1. Bulletins validés figés -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public._bulletin_valide_fige() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE libres text[] := ARRAY['statut','date_paiement','mode_paiement','pdf_url','updated_at'];
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN COALESCE(NEW, OLD); END IF;
  IF OLD.statut NOT IN ('valide', 'paye') THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Bulletin % % : suppression interdite', OLD.reference, OLD.statut;
  END IF;
  IF NOT (NEW.statut = OLD.statut OR (OLD.statut = 'valide' AND NEW.statut = 'paye')) THEN
    RAISE EXCEPTION 'Bulletin % % : passage au statut « % » interdit', OLD.reference, OLD.statut, NEW.statut;
  END IF;
  IF (to_jsonb(NEW) - libres) IS DISTINCT FROM (to_jsonb(OLD) - libres) THEN
    RAISE EXCEPTION 'Bulletin % % : montants et données figés, passer par une régularisation', OLD.reference, OLD.statut;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_bulletin_valide_fige ON public.bulletins_paie;
CREATE TRIGGER trg_bulletin_valide_fige BEFORE UPDATE OR DELETE ON public.bulletins_paie
  FOR EACH ROW EXECUTE FUNCTION public._bulletin_valide_fige();

CREATE OR REPLACE FUNCTION public._bulletin_lignes_fige() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_statut text; v_ref text;
BEGIN
  -- SECURITY DEFINER pour lire le statut du bulletin quelle que soit la RLS ; current_user
  -- devient alors le propriétaire, d'où le test sur le rôle du jeton de l'appel (PostgREST).
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''),
              NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '') NOT IN ('authenticated', 'anon') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT statut, reference INTO v_statut, v_ref FROM bulletins_paie
   WHERE bulletin_id = COALESCE(NEW.bulletin_id, OLD.bulletin_id);
  IF v_statut IN ('valide', 'paye') THEN
    RAISE EXCEPTION 'Bulletin % % : lignes figées', v_ref, v_statut;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_bulletin_lignes_fige ON public.bulletin_lignes;
CREATE TRIGGER trg_bulletin_lignes_fige BEFORE INSERT OR UPDATE OR DELETE ON public.bulletin_lignes
  FOR EACH ROW EXECUTE FUNCTION public._bulletin_lignes_fige();

-- 2. Congés, absences, contrats : dates et chevauchements ------------------------------
ALTER TABLE public.conges DROP CONSTRAINT IF EXISTS conges_dates_coherentes;
ALTER TABLE public.conges ADD CONSTRAINT conges_dates_coherentes
  CHECK (date_fin >= date_debut) NOT VALID;
ALTER TABLE public.absences DROP CONSTRAINT IF EXISTS absences_dates_coherentes;
ALTER TABLE public.absences ADD CONSTRAINT absences_dates_coherentes
  CHECK (date_debut IS NULL OR date_fin IS NULL OR date_fin >= date_debut) NOT VALID;
ALTER TABLE public.contrats DROP CONSTRAINT IF EXISTS contrats_dates_coherentes;
ALTER TABLE public.contrats ADD CONSTRAINT contrats_dates_coherentes
  CHECK (date_debut IS NULL OR date_fin IS NULL OR date_fin >= date_debut) NOT VALID;

-- Statuts qui ne comptent plus (même liste que le moteur de paie pour les absences).
CREATE OR REPLACE FUNCTION public._rh_statut_inactif(_statut text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT lower(COALESCE(_statut, '')) IN ('annule','annulee','refuse','refusee','rejete','rejetee');
$$;

CREATE OR REPLACE FUNCTION public._rh_sans_chevauchement() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_conflit boolean;
BEGIN
  -- SECURITY DEFINER : le contrôle voit toutes les demandes du salarié, même celles que
  -- la RLS cache à l'utilisateur ; il ne renvoie qu'un refus, aucune donnée.
  IF NEW.employe_id IS NULL OR NEW.date_debut IS NULL OR NEW.date_fin IS NULL
     OR _rh_statut_inactif(NEW.statut) THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'conges' THEN
    SELECT EXISTS (SELECT 1 FROM conges c WHERE c.employe_id = NEW.employe_id
      AND c.conge_id IS DISTINCT FROM NEW.conge_id AND NOT _rh_statut_inactif(c.statut)
      AND c.date_debut <= NEW.date_fin AND c.date_fin >= NEW.date_debut) INTO v_conflit;
  ELSE
    SELECT EXISTS (SELECT 1 FROM absences a WHERE a.employe_id = NEW.employe_id
      AND a.absence_id IS DISTINCT FROM NEW.absence_id AND NOT _rh_statut_inactif(a.statut)
      AND a.date_debut <= NEW.date_fin AND a.date_fin >= NEW.date_debut) INTO v_conflit;
  END IF;
  IF v_conflit THEN
    RAISE EXCEPTION 'Ce salarié a déjà % sur cette période (du % au %)',
      CASE TG_TABLE_NAME WHEN 'conges' THEN 'un congé' ELSE 'une absence' END,
      to_char(NEW.date_debut, 'DD/MM/YYYY'), to_char(NEW.date_fin, 'DD/MM/YYYY');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._rh_sans_chevauchement() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_conges_sans_chevauchement ON public.conges;
CREATE TRIGGER trg_conges_sans_chevauchement BEFORE INSERT OR UPDATE OF employe_id, date_debut, date_fin, statut
  ON public.conges FOR EACH ROW EXECUTE FUNCTION public._rh_sans_chevauchement();
DROP TRIGGER IF EXISTS trg_absences_sans_chevauchement ON public.absences;
CREATE TRIGGER trg_absences_sans_chevauchement BEFORE INSERT OR UPDATE OF employe_id, date_debut, date_fin, statut
  ON public.absences FOR EACH ROW EXECUTE FUNCTION public._rh_sans_chevauchement();

-- 3. Moteur : salarié non actif, entrée ou sortie en cours de période -----------------
DO $$
DECLARE d text; n text;
BEGIN
  d := pg_get_functiondef('public.paie_calculer_bulletin(uuid, date, date, jsonb)'::regprocedure);
  n := replace(d, '  -- Salaire, sursalaire, parts',
'  IF e.deleted_at IS NOT NULL OR e.actif IS FALSE OR COALESCE(e.statut_employe::text, ''actif'') <> ''actif'' THEN
    anom := anom || to_jsonb(''Salarié non actif ('' || COALESCE(e.statut_employe::text, ''fiche inactive'')
      || '') : bulletin individuel de régularisation uniquement'');
  END IF;
  IF NOT s ? ''jours_travailles'' AND (e.date_embauche > p_date_debut OR e.date_fin_contrat < p_date_fin) THEN
    anom := anom || ''"Entrée ou sortie en cours de période : saisir les jours travaillés"''::jsonb;
  END IF;

  -- Salaire, sursalaire, parts');
  IF n = d THEN RAISE EXCEPTION 'paie_calculer_bulletin : point d''insertion des anomalies introuvable'; END IF;
  EXECUTE n;
END $$;
