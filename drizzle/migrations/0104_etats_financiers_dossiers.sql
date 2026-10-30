-- États financiers annuels, phase 2 : dossier annuel figé.
--   Chaque génération enregistre une version du dossier d'un exercice : états
--   calculés, contrôles, identification, source des données et empreinte des
--   données comptables utilisées. Une version validée n'est jamais modifiée ni
--   supprimée : la réouvrir la marque « dévalidée » (motif, auteur, date) et une
--   nouvelle génération crée une nouvelle version.
--   Droits (existants) : consultation comptabilite.voir ; génération
--   exercices.modifier ; validation et réouverture exercices.cloturer.

CREATE TABLE IF NOT EXISTS public.etats_financiers_dossiers (
  dossier_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercice_id uuid NOT NULL REFERENCES public.exercices_comptables(exercice_id) ON DELETE RESTRICT,
  version integer NOT NULL,
  -- brouillon : dernière génération ; remplace : brouillon dépassé par une génération
  -- plus récente ; valide : dossier validé ; devalide : validé puis réouvert.
  statut text NOT NULL DEFAULT 'brouillon'
    CHECK (statut IN ('brouillon', 'remplace', 'valide', 'devalide')),
  -- Statut des contrôles au moment de la génération : incomplet / a_verifier / pret.
  preparation text NOT NULL CHECK (preparation IN ('incomplet', 'a_verifier', 'pret')),
  nb_bloquants integer NOT NULL DEFAULT 0,
  nb_avertissements integer NOT NULL DEFAULT 0,
  source text NOT NULL,
  version_modele text NOT NULL,
  version_regles text NOT NULL,
  -- Empreinte des écritures et balances importées utilisées (etats_financiers_empreinte).
  empreinte text NOT NULL,
  contenu jsonb NOT NULL,
  genere_par uuid DEFAULT auth.uid(),
  genere_le timestamptz NOT NULL DEFAULT now(),
  valide_par uuid,
  valide_le timestamptz,
  commentaire_validation text,
  devalide_par uuid,
  devalide_le timestamptz,
  motif_devalidation text,
  UNIQUE (exercice_id, version)
);
-- Au plus un dossier validé en vigueur par exercice.
CREATE UNIQUE INDEX IF NOT EXISTS etats_financiers_dossiers_valide
  ON public.etats_financiers_dossiers (exercice_id) WHERE statut = 'valide';

ALTER TABLE public.etats_financiers_dossiers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.etats_financiers_dossiers FROM anon, authenticated;
GRANT SELECT ON public.etats_financiers_dossiers TO authenticated;
GRANT ALL ON public.etats_financiers_dossiers TO service_role;
DROP POLICY IF EXISTS etats_financiers_dossiers_read ON public.etats_financiers_dossiers;
CREATE POLICY etats_financiers_dossiers_read ON public.etats_financiers_dossiers FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'comptabilite.voir'));

-- Le contenu d'une version est inaltérable ; seuls le statut et les champs de
-- validation évoluent, et une version n'est jamais supprimée.
CREATE OR REPLACE FUNCTION public.etats_financiers_dossiers_garde()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Un dossier d''états financiers ne peut pas être supprimé' USING ERRCODE = '42501';
  END IF;
  IF NEW.exercice_id IS DISTINCT FROM OLD.exercice_id OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.contenu IS DISTINCT FROM OLD.contenu OR NEW.empreinte IS DISTINCT FROM OLD.empreinte
     OR NEW.preparation IS DISTINCT FROM OLD.preparation OR NEW.source IS DISTINCT FROM OLD.source
     OR NEW.genere_par IS DISTINCT FROM OLD.genere_par OR NEW.genere_le IS DISTINCT FROM OLD.genere_le THEN
    RAISE EXCEPTION 'Le contenu d''une version du dossier est inaltérable' USING ERRCODE = '42501';
  END IF;
  IF OLD.statut IN ('remplace', 'devalide') THEN
    RAISE EXCEPTION 'Version close : statut %', OLD.statut USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_etats_financiers_dossiers_garde ON public.etats_financiers_dossiers;
CREATE TRIGGER trg_etats_financiers_dossiers_garde
  BEFORE UPDATE OR DELETE ON public.etats_financiers_dossiers
  FOR EACH ROW EXECUTE FUNCTION public.etats_financiers_dossiers_garde();

-- Empreinte des données d'un exercice : toutes les lignes d'écritures jusqu'à la
-- clôture (le bilan dépend du cumul) et les balances importées actives de
-- l'exercice et du précédent. Toute écriture ajoutée, modifiée ou supprimée la change.
CREATE OR REPLACE FUNCTION public.etats_financiers_empreinte(p_exercice_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fin date; v_debut date; v_ecr text; v_lots text;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'comptabilite.voir') THEN
    RAISE EXCEPTION 'Permission refusée : comptabilite.voir' USING ERRCODE = '42501';
  END IF;
  SELECT date_debut, date_fin INTO v_debut, v_fin
    FROM public.exercices_comptables WHERE exercice_id = p_exercice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exercice inconnu'; END IF;
  SELECT md5(coalesce(string_agg(
           el.ligne_id::text || '|' || ec.date_ecriture || '|' || el.compte || '|'
           || el.debit::text || '|' || el.credit::text, ',' ORDER BY el.ligne_id), ''))
    INTO v_ecr
    FROM public.ecriture_lignes el
    JOIN public.ecritures_comptables ec ON ec.ecriture_id = el.ecriture_id
   WHERE ec.date_ecriture <= v_fin;
  SELECT coalesce(string_agg(l.lot_id::text, ',' ORDER BY l.lot_id), '') INTO v_lots
    FROM public.balances_importees_lots l
   WHERE l.remplace_le IS NULL
     AND (l.exercice_id = p_exercice_id
          OR l.exercice_id = (SELECT e.exercice_id FROM public.exercices_comptables e
                               WHERE e.date_fin < v_debut ORDER BY e.date_fin DESC LIMIT 1));
  RETURN md5(v_ecr || '#' || v_lots);
END $$;
REVOKE ALL ON FUNCTION public.etats_financiers_empreinte(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.etats_financiers_empreinte(uuid) TO authenticated;

-- Enregistre une génération. Refusé si un dossier validé est en vigueur : il faut
-- d'abord le réouvrir (motif tracé). Le brouillon précédent passe en « remplace ».
CREATE OR REPLACE FUNCTION public.etats_financiers_enregistrer_dossier(
  p_exercice_id uuid, p_preparation text, p_nb_bloquants integer, p_nb_avertissements integer,
  p_source text, p_version_modele text, p_version_regles text, p_contenu jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_version integer;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'exercices.modifier') THEN
    RAISE EXCEPTION 'Permission refusée : exercices.modifier' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.exercices_comptables WHERE exercice_id = p_exercice_id) THEN
    RAISE EXCEPTION 'Exercice inconnu';
  END IF;
  -- Verrou par exercice : deux générations simultanées n'obtiennent pas la même version.
  PERFORM pg_advisory_xact_lock(hashtext('etats_financiers_dossiers:' || p_exercice_id::text));
  IF EXISTS (SELECT 1 FROM public.etats_financiers_dossiers
              WHERE exercice_id = p_exercice_id AND statut = 'valide') THEN
    RAISE EXCEPTION 'Le dossier de cet exercice est validé : le réouvrir avant de régénérer';
  END IF;
  IF jsonb_typeof(p_contenu) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Contenu du dossier invalide';
  END IF;
  UPDATE public.etats_financiers_dossiers SET statut = 'remplace'
   WHERE exercice_id = p_exercice_id AND statut = 'brouillon';
  SELECT coalesce(max(version), 0) + 1 INTO v_version
    FROM public.etats_financiers_dossiers WHERE exercice_id = p_exercice_id;
  INSERT INTO public.etats_financiers_dossiers
    (exercice_id, version, preparation, nb_bloquants, nb_avertissements, source,
     version_modele, version_regles, empreinte, contenu)
  VALUES (p_exercice_id, v_version, p_preparation, coalesce(p_nb_bloquants, 0),
          coalesce(p_nb_avertissements, 0), p_source, p_version_modele, p_version_regles,
          public.etats_financiers_empreinte(p_exercice_id), p_contenu)
  RETURNING dossier_id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.etats_financiers_enregistrer_dossier(uuid, text, integer, integer, text, text, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.etats_financiers_enregistrer_dossier(uuid, text, integer, integer, text, text, text, jsonb) TO authenticated;

-- Valide la dernière génération. Refusé s'il reste des contrôles bloquants ou si
-- les données comptables ont changé depuis la génération (il faut régénérer).
CREATE OR REPLACE FUNCTION public.etats_financiers_valider_dossier(p_dossier_id uuid, p_commentaire text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.etats_financiers_dossiers; v_debut date; v_fin date;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'exercices.cloturer') THEN
    RAISE EXCEPTION 'Permission refusée : exercices.cloturer' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO d FROM public.etats_financiers_dossiers WHERE dossier_id = p_dossier_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dossier inconnu'; END IF;
  IF d.statut <> 'brouillon' THEN
    RAISE EXCEPTION 'Seule la dernière génération peut être validée (statut actuel : %)', d.statut;
  END IF;
  IF d.nb_bloquants > 0 OR d.preparation = 'incomplet' THEN
    RAISE EXCEPTION 'Dossier incomplet : % contrôle(s) bloquant(s)', d.nb_bloquants;
  END IF;
  IF d.empreinte <> public.etats_financiers_empreinte(d.exercice_id) THEN
    RAISE EXCEPTION 'Les données comptables ont changé depuis la génération : régénérer le dossier';
  END IF;
  -- Contrôle refait en base, indépendamment des contrôles transmis par l'application.
  SELECT e.date_debut, e.date_fin INTO v_debut, v_fin
    FROM public.exercices_comptables e WHERE e.exercice_id = d.exercice_id;
  IF (public.etats_financiers_completude(v_debut, v_fin) ->> 'ecritures_desequilibrees')::int > 0 THEN
    RAISE EXCEPTION 'Des écritures de l''exercice sont déséquilibrées : dossier non validable';
  END IF;
  UPDATE public.etats_financiers_dossiers
     SET statut = 'valide', valide_par = auth.uid(), valide_le = now(),
         commentaire_validation = nullif(btrim(p_commentaire), '')
   WHERE dossier_id = p_dossier_id;
END $$;
REVOKE ALL ON FUNCTION public.etats_financiers_valider_dossier(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.etats_financiers_valider_dossier(uuid, text) TO authenticated;

-- Réouvre un dossier validé : la version reste conservée, marquée « dévalidée ».
CREATE OR REPLACE FUNCTION public.etats_financiers_rouvrir_dossier(p_dossier_id uuid, p_motif text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_statut text;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'exercices.cloturer') THEN
    RAISE EXCEPTION 'Permission refusée : exercices.cloturer' USING ERRCODE = '42501';
  END IF;
  IF char_length(btrim(coalesce(p_motif, ''))) < 5 THEN
    RAISE EXCEPTION 'Motif de réouverture obligatoire';
  END IF;
  SELECT statut INTO v_statut FROM public.etats_financiers_dossiers
   WHERE dossier_id = p_dossier_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dossier inconnu'; END IF;
  IF v_statut <> 'valide' THEN RAISE EXCEPTION 'Ce dossier n''est pas validé'; END IF;
  UPDATE public.etats_financiers_dossiers
     SET statut = 'devalide', devalide_par = auth.uid(), devalide_le = now(),
         motif_devalidation = btrim(p_motif)
   WHERE dossier_id = p_dossier_id;
END $$;
REVOKE ALL ON FUNCTION public.etats_financiers_rouvrir_dossier(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.etats_financiers_rouvrir_dossier(uuid, text) TO authenticated;

-- Historique lisible : versions d'un exercice avec le nom des auteurs.
CREATE OR REPLACE FUNCTION public.etats_financiers_historique(p_exercice_id uuid)
RETURNS TABLE(dossier_id uuid, version integer, statut text, preparation text,
              nb_bloquants integer, nb_avertissements integer, source text,
              version_modele text, version_regles text, empreinte text,
              genere_le timestamptz, genere_par_nom text,
              valide_le timestamptz, valide_par_nom text, commentaire_validation text,
              devalide_le timestamptz, devalide_par_nom text, motif_devalidation text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.dossier_id, d.version, d.statut, d.preparation, d.nb_bloquants, d.nb_avertissements,
         d.source, d.version_modele, d.version_regles, d.empreinte, d.genere_le,
         (SELECT coalesce(nullif(btrim(p.nom_complet), ''), p.email) FROM public.profiles p WHERE p.id = d.genere_par),
         d.valide_le,
         (SELECT coalesce(nullif(btrim(p.nom_complet), ''), p.email) FROM public.profiles p WHERE p.id = d.valide_par),
         d.commentaire_validation, d.devalide_le,
         (SELECT coalesce(nullif(btrim(p.nom_complet), ''), p.email) FROM public.profiles p WHERE p.id = d.devalide_par),
         d.motif_devalidation
    FROM public.etats_financiers_dossiers d
   WHERE d.exercice_id = p_exercice_id
     AND public.has_permission(auth.uid(), 'comptabilite.voir')
   ORDER BY d.version DESC;
$$;
REVOKE ALL ON FUNCTION public.etats_financiers_historique(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.etats_financiers_historique(uuid) TO authenticated;

-- Un exercice dont le dossier est validé ne reçoit plus de balance importée :
-- même contrôle d'entrée que la phase 1, plus ce verrou.
CREATE OR REPLACE FUNCTION public.etats_financiers_balance_verrou()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.etats_financiers_dossiers
              WHERE exercice_id = NEW.exercice_id AND statut = 'valide') THEN
    RAISE EXCEPTION 'Le dossier de cet exercice est validé : le réouvrir avant d''importer une balance'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_balances_importees_lots_verrou ON public.balances_importees_lots;
CREATE TRIGGER trg_balances_importees_lots_verrou
  BEFORE INSERT ON public.balances_importees_lots
  FOR EACH ROW EXECUTE FUNCTION public.etats_financiers_balance_verrou();
