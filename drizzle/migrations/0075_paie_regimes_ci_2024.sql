CREATE TABLE IF NOT EXISTS public.paie_regimes (
  code text PRIMARY KEY,
  libelle text NOT NULL,
  date_effet date NOT NULL,
  actif boolean NOT NULL DEFAULT true,
  parametres jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.paie_regimes TO authenticated;
GRANT INSERT, UPDATE ON public.paie_regimes TO authenticated;
GRANT ALL ON public.paie_regimes TO service_role;
ALTER TABLE public.paie_regimes ENABLE ROW LEVEL SECURITY;
CREATE POLICY paie_regimes_read ON public.paie_regimes FOR SELECT TO authenticated
  USING (is_hr(auth.uid()) OR has_permission(auth.uid(), 'paie.voir'));
CREATE POLICY paie_regimes_write ON public.paie_regimes FOR ALL TO authenticated
  USING (rbac3_can('rh.modifier')) WITH CHECK (rbac3_can('rh.modifier'));

INSERT INTO public.paie_regimes (code, libelle, date_effet, parametres) VALUES
('REGIME_2024','Réforme ITS 2024','2024-01-01', '{"its_bareme":[[75000,0],[240000,16],[800000,21],[2400000,24],[8000000,28],[null,32]],"ricf_par_demi_part":5500,"cr_taux":6.3,"cr_plafond":3375000,"cmu_salarie":500,"cmu_patronal":500,"transport_plafond":30000,"arrondi_unite":100,"retraite_pat_taux":7.7,"retraite_pat_plafond":3375000,"pf_taux":5,"maternite_taux":0.75,"at_taux":2,"plafond_prestations":70000,"fdfp_actif":false,"fdfp_taux":0}'::jsonb),
('REGIME_2022','Régime historique (ITS 1,2 %, CN, IGR)','1900-01-01', '{"its_taux_forfait":1.2,"cn_abattement":80,"cn_bareme":[[50000,0],[130000,1.5],[200000,5],[null,10]],"cr_taux":6.3,"cr_plafond":3375000,"cmu_salarie":500,"cmu_patronal":500,"transport_plafond":30000,"arrondi_unite":100,"retraite_pat_taux":7.7,"retraite_pat_plafond":3375000,"pf_taux":5,"maternite_taux":0.75,"at_taux":2,"plafond_prestations":70000,"fdfp_actif":false,"fdfp_taux":0}'::jsonb)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.employes
  ADD COLUMN IF NOT EXISTS parts numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS mode_paiement_defaut text;
ALTER TABLE public.employes ADD CONSTRAINT employes_parts_chk
  CHECK (parts >= 1 AND parts <= 5 AND (parts * 2) = trunc(parts * 2));

ALTER TABLE public.bulletins_paie
  ADD COLUMN IF NOT EXISTS date_debut date,
  ADD COLUMN IF NOT EXISTS date_fin date,
  ADD COLUMN IF NOT EXISTS date_etablissement date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS date_paiement date,
  ADD COLUMN IF NOT EXISTS mode_paiement text,
  ADD COLUMN IF NOT EXISTS jours_travailles numeric NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS regime_code text REFERENCES public.paie_regimes(code),
  ADD COLUMN IF NOT EXISTS parts numeric,
  ADD COLUMN IF NOT EXISTS saisie jsonb,
  ADD COLUMN IF NOT EXISTS brut_imposable numeric,
  ADD COLUMN IF NOT EXISTS total_indemnites_non_imposables numeric,
  ADD COLUMN IF NOT EXISTS total_autres_retenues numeric,
  ADD COLUMN IF NOT EXISTS arrondi numeric,
  ADD COLUMN IF NOT EXISTS net_a_payer numeric,
  ADD COLUMN IF NOT EXISTS cout_salarial numeric;
CREATE UNIQUE INDEX IF NOT EXISTS bulletins_paie_employe_periode_uniq
  ON public.bulletins_paie (employe_id, date_debut, date_fin) WHERE date_debut IS NOT NULL;
COMMENT ON COLUMN public.bulletins_paie.periode IS 'DEPRECATED: replaced by date_debut/date_fin';

ALTER TABLE public.bulletin_lignes
  ADD COLUMN IF NOT EXISTS numero_rubrique text,
  ADD COLUMN IF NOT EXISTS designation text,
  ADD COLUMN IF NOT EXISTS nombre numeric,
  ADD COLUMN IF NOT EXISTS gain numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retenue numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bloc text CHECK (bloc IN ('imposable','retenue','non_imposable','arrondi','patronal')),
  ADD COLUMN IF NOT EXISTS ordre integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS bulletin_lignes_bulletin_ordre_idx ON public.bulletin_lignes (bulletin_id, ordre);