ALTER TABLE public.parametres_paie
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS libelle text,
  ADD COLUMN IF NOT EXISTS unite text DEFAULT 'FCFA',
  ADD COLUMN IF NOT EXISTS categorie text DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS actif boolean DEFAULT true;

UPDATE public.parametres_paie SET code = COALESCE(code, cle), libelle = COALESCE(libelle, cle) WHERE code IS NULL OR libelle IS NULL;

ALTER TABLE public.parametres_paie ALTER COLUMN parametre_id SET DEFAULT gen_random_uuid();
ALTER TABLE public.parametres_paie ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.parametres_paie ALTER COLUMN updated_at SET DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS ux_parametres_paie_code ON public.parametres_paie (code) WHERE code IS NOT NULL;

ALTER TABLE public.rubriques_paie
  ADD COLUMN IF NOT EXISTS mode_calcul text DEFAULT 'fixe',
  ADD COLUMN IF NOT EXISTS base text DEFAULT 'salaire_base',
  ADD COLUMN IF NOT EXISTS montant_fixe numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS soumis_cnps boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS soumis_its boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS soumis_igr boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS ordre integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.rubriques_paie ALTER COLUMN rubrique_id SET DEFAULT gen_random_uuid();
ALTER TABLE public.rubriques_paie ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.rubriques_paie ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.rubriques_paie ALTER COLUMN actif SET DEFAULT true;
ALTER TABLE public.rubriques_paie ALTER COLUMN taux SET DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS ux_rubriques_paie_code ON public.rubriques_paie (code) WHERE code IS NOT NULL;

DROP VIEW IF EXISTS public.paie_parametres;
CREATE VIEW public.paie_parametres AS
  SELECT parametre_id, cle, code, libelle, valeur, unite, categorie, actif, description, created_at, updated_at
  FROM public.parametres_paie;

DROP VIEW IF EXISTS public.paie_rubriques;
CREATE VIEW public.paie_rubriques AS
  SELECT rubrique_id, code, libelle, type, mode_calcul, base, formule, taux, montant_fixe,
         soumis_cnps, soumis_its, soumis_igr, ordre, actif, description, created_at, updated_at
  FROM public.rubriques_paie;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.paie_parametres TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paie_rubriques TO authenticated;
GRANT ALL ON public.paie_parametres TO service_role;
GRANT ALL ON public.paie_rubriques TO service_role;

ALTER TABLE public.bulletins_paie
  ADD COLUMN IF NOT EXISTS employe_nom text,
  ADD COLUMN IF NOT EXISTS retenues numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exercice_id uuid;

CREATE INDEX IF NOT EXISTS idx_bulletins_paie_exercice ON public.bulletins_paie (exercice_id);