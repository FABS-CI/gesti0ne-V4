-- États financiers annuels, phase 3 : modèle Excel de la liasse.
--   Le classeur de référence (EDITION FABS-CI 2025.xlsm) contient des données
--   réelles : il n'est pas livré avec l'application mais déposé dans l'ERP par un
--   utilisateur autorisé, dans un espace de stockage privé. Chaque dépôt est
--   conservé et daté ; le dernier sert aux exports (version du modèle).
--   Droits : lecture comptabilite.voir ; dépôt exercices.modifier.

INSERT INTO storage.buckets (id, name, public)
  VALUES ('etats-financiers-modeles', 'etats-financiers-modeles', false)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS etats_financiers_modeles_lecture ON storage.objects;
CREATE POLICY etats_financiers_modeles_lecture ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'etats-financiers-modeles'
         AND public.has_permission(auth.uid(), 'comptabilite.voir'));
-- Dépôt seulement : un modèle déposé n'est ni remplacé ni supprimé (historique).
DROP POLICY IF EXISTS etats_financiers_modeles_depot ON storage.objects;
CREATE POLICY etats_financiers_modeles_depot ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'etats-financiers-modeles'
              AND public.has_permission(auth.uid(), 'exercices.modifier'));

CREATE TABLE IF NOT EXISTS public.etats_financiers_modeles (
  modele_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chemin text NOT NULL UNIQUE,
  nom_fichier text NOT NULL,
  taille bigint NOT NULL,
  -- Empreinte SHA-256 du fichier : identifie la version du modèle utilisée.
  sha256 text NOT NULL,
  avec_macros boolean NOT NULL DEFAULT false,
  depose_par uuid DEFAULT auth.uid(),
  depose_le timestamptz NOT NULL DEFAULT now(),
  remplace_le timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS etats_financiers_modeles_actif
  ON public.etats_financiers_modeles ((true)) WHERE remplace_le IS NULL;

ALTER TABLE public.etats_financiers_modeles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.etats_financiers_modeles FROM anon, authenticated;
GRANT SELECT ON public.etats_financiers_modeles TO authenticated;
GRANT ALL ON public.etats_financiers_modeles TO service_role;
DROP POLICY IF EXISTS etats_financiers_modeles_read ON public.etats_financiers_modeles;
CREATE POLICY etats_financiers_modeles_read ON public.etats_financiers_modeles FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'comptabilite.voir'));

-- Enregistre un modèle déjà déposé dans le stockage ; le précédent reste conservé.
CREATE OR REPLACE FUNCTION public.etats_financiers_enregistrer_modele(
  p_chemin text, p_nom_fichier text, p_taille bigint, p_sha256 text, p_avec_macros boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'exercices.modifier') THEN
    RAISE EXCEPTION 'Permission refusée : exercices.modifier' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects
                  WHERE bucket_id = 'etats-financiers-modeles' AND name = p_chemin) THEN
    RAISE EXCEPTION 'Fichier du modèle introuvable dans le stockage';
  END IF;
  IF p_sha256 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Empreinte du modèle invalide'; END IF;
  UPDATE public.etats_financiers_modeles SET remplace_le = now() WHERE remplace_le IS NULL;
  INSERT INTO public.etats_financiers_modeles (chemin, nom_fichier, taille, sha256, avec_macros)
    VALUES (p_chemin, p_nom_fichier, p_taille, p_sha256, coalesce(p_avec_macros, false))
    RETURNING modele_id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.etats_financiers_enregistrer_modele(text, text, bigint, text, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.etats_financiers_enregistrer_modele(text, text, bigint, text, boolean) TO authenticated;
